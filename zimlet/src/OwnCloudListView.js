/**
 * List view to display the content of the DAV navigator.
 * @param {DwtShell} parent
 * @param {string} appName
 * @param {OwnCloudApp} ocZimletApp
 * @param {OwnCloudCommons} ocCommons
 * @param {AjxCallback} onFolderSelectedCbk
 * @constructor
 */
function OwnCloudListView(
  parent,
  appName,
  ocZimletApp,
  davConnector,
  ocCommons,
  onFolderSelectedCbk
) {
  DwtListView.call(this, {
    parent: parent,
    headerList: this._getHeaderList()
  });

  this._appName = appName;
  this._ocZimletApp = ocZimletApp;
  this._davConnector = davConnector;
  this._ocCommons = ocCommons;
  this._onFolderSelectedCbk = onFolderSelectedCbk;
  this._listeners = {};

  this.createHeaderHtml(ZmItem.F_NAME);
  this.setSize("100%", "100%");

  this._listeners[ZmOperation.SEND_FILE]			  = (function(_this) { return function() {_this._sendFileListener.apply(_this, arguments); }; })(this);
  this._listeners[ZmOperation.SEND_FILE_AS_ATT]	= (function(_this) { return function() {_this._sendFileAsAttachmentListener.apply(_this, arguments); }; })(this);
  this._listeners[ZmOperation.DELETE]           = (function(_this) { return function() {_this._deleteListener.apply(_this, arguments); }; })(this);
  this._listeners[ZmOperation.RENAME_FILE]      = (function(_this) { return function() {_this._renameFileListener.apply(_this, arguments); }; })(this);
  this._listeners[ZmOperation.RENAME_FOLDER]    = (function(_this) { return function() {_this._renameFolderListener.apply(_this, arguments); }; })(this);
  this._listeners[ZmOperation.NEW_FOLDER]    = (function(_this) { return function() {_this._newFolderListener.apply(_this, arguments); }; })(this);
  this._listeners[ZmOperation.SAVE_FILE]        = (function(_this) { return function() {_this._saveFileListener.apply(_this, arguments); }; })(this);

  this.addActionListener(new AjxListener(this, this._listActionListener));
  this.addSelectionListener(new AjxListener(this, this._onItemSelected));

  this._dragSrc = new DwtDragSource(Dwt.DND_DROP_MOVE);
  this._dragSrc.addDragListener(new AjxListener(this, OwnCloudApp._dragListener));
  this.setDragSource(this._dragSrc);

  this._dropTgt = new DwtDropTarget("DavResource");
  this._dropTgt.markAsMultiple();
  this._dropTgt.addDropListener(new AjxListener(this, OwnCloudApp._dropListener, [ocZimletApp]));
  this.setDropTarget(this._dropTgt);
}

OwnCloudListView.prototype = new DwtListView();
OwnCloudListView.prototype.constructor = OwnCloudListView;

OwnCloudListView.prototype._getHeaderList = function () {
  var headers = [];
  headers.push(new DwtListHeaderItem({
    field: ZmItem.F_TYPE,
    icon: "GenericDoc",
    width: 20,
    name: ZmMsg.icon
  }));
  //headers.push(new DwtListHeaderItem({field: ZmItem.F_NAME, text: ZmMsg._name, sortable: ZmItem.F_NAME}));
  headers.push(new DwtListHeaderItem({field: ZmItem.F_NAME, text: ZmMsg._name}));
  headers.push(new DwtListHeaderItem({
    field: ZmItem.F_FILE_TYPE,
    text: ZmMsg.type,
    width: ZmMsg.COLUMN_WIDTH_TYPE_DLV,
    //sortable: ZmItem.F_FILE_TYPE
  }));
  headers.push(new DwtListHeaderItem({
    field: ZmItem.F_SIZE,
    text: ZmMsg.size,
    width: ZmMsg.COLUMN_WIDTH_SIZE_DLV,
    //sortable: ZmItem.F_SIZE
  }));
  headers.push(new DwtListHeaderItem({
    field: ZmItem.F_DATE,
    text: ZmMsg.modified,
    width: ZmMsg.COLUMN_WIDTH_DATE_DLV,
    //sortable: ZmItem.F_DATE
  }));
  return headers;
};

OwnCloudListView.prototype._getCellContents = function (htmlArr, idx, item, field, colIdx, params) {

  if (field === ZmItem.F_TYPE) {

    if (item.isDirectory()) {
      htmlArr[idx++] = AjxImg.getImageHtml("Folder");
    } else {
      var type = ZmMimeTable.getInfo(item.getContentType());

      if (typeof type !== "undefined") {
        htmlArr[idx++] = AjxImg.getImageHtml(type.image);
      } else {
        htmlArr[idx++] = AjxImg.getImageHtml("GenericDoc");
      }
    }

  } else if (field === ZmItem.F_NAME) {

    htmlArr[idx++] = AjxStringUtil.htmlEncode(item.getName());

  } else if (field === ZmItem.F_FILE_TYPE) {

    if (item.isDirectory()) {
      htmlArr[idx++] = ZmMsg.folder;
    } else {
      if (typeof item.getContentType() !== "undefined") {
        htmlArr[idx++] = item.getContentType();
      } else {
        htmlArr[idx++] = ZmMsg.unknown;
      }
    }

  } else if (field === ZmItem.F_SIZE) {

    if (item.isDirectory()) {
      htmlArr[idx++] = "";
    } else {
      htmlArr[idx++] = AjxUtil.formatSize(item.getContentLength());
    }

  } else if (field === ZmItem.F_DATE) {

    if (typeof item.getModified() !== "undefined") {
      htmlArr[idx++] = AjxDateUtil.simpleComputeDateStr(item.getModified());
    } else {
      htmlArr[idx++] = ZmMsg.unknown;
    }

  } else {

    htmlArr[idx++] = item.toString ? item.toString() : item;

  }

  return idx;
};

OwnCloudListView.prototype._resetOperations = function (parent, resource, resources) {
  var directoriesInvolved = false,
    operations = this._getActionMenuOps(),
    operationsEnabled = [],
    menuItem,
    i;

  parent.enableAll(false);
  parent.getMenuItem(ZmOperation.RENAME_FOLDER).setVisible(false);
  parent.getMenuItem(ZmOperation.NEW_FOLDER).setVisible(false);
  parent.getMenuItem(ZmOperation.RENAME_FILE).setVisible(false);
  parent.getMenuItem(ZmOperation.SAVE_FILE).setVisible(false);

  for (i = 0; i <  resources.length; i += 1) {
    if (resources[i].isDirectory()) {
      directoriesInvolved = true;
      break;
    }
  }

  operationsEnabled = [
    ZmOperation.SEND_FILE,
    ZmOperation.SEND_FILE_AS_ATT,
    ZmOperation.DELETE
  ];

  if (resources.length === 1) { 
    parent.getMenuItem(ZmOperation.DELETE).setVisible(true);   
    if (resource.isDirectory()) {
      operationsEnabled.push(ZmOperation.RENAME_FOLDER);
      parent.getMenuItem(ZmOperation.RENAME_FOLDER).setVisible(true);
      operationsEnabled.push(ZmOperation.NEW_FOLDER);
      parent.getMenuItem(ZmOperation.NEW_FOLDER).setVisible(true);      
    } else {
      operationsEnabled.push(ZmOperation.RENAME_FILE);
      operationsEnabled.push(ZmOperation.SAVE_FILE);
      parent.getMenuItem(ZmOperation.RENAME_FILE).setVisible(true);
      parent.getMenuItem(ZmOperation.SAVE_FILE).setVisible(true);
    }
  }
  else
  {
     parent.getMenuItem(ZmOperation.DELETE).setVisible(false);
  }

  parent.enable(operationsEnabled, true);

  if (directoriesInvolved) {
    parent.enable([
      ZmOperation.SEND_FILE_AS_ATT
    ], false);
  }
};

OwnCloudListView.prototype._listActionListener = function (ev) {
  var actionMenu = this.getActionMenu(ev.item, this.getSelection());
  this._resetOperations(actionMenu, ev.item, this.getSelection());
  actionMenu.popup(0, ev.docX, ev.docY);
  // if (ev.ersatz) {
  //   actionMenu.setSelectedItem(0); // menu popped up via keyboard nav
  // }
};

OwnCloudListView.prototype.getActionMenu = function (resource, resources) {
  if (!this._actionMenu) {
    this._initializeActionMenu();
    //DBG.timePt("_initializeActionMenu");
    this._resetOperations(this._actionMenu, resource, resources);
    //DBG.timePt("this._resetOperation(actionMenu)");
  }
  return this._actionMenu;
};

OwnCloudListView.prototype._initializeActionMenu = function () {

  if (this._actionMenu) {
    return;
  }

  var menuItems = this._getActionMenuOps();
  if (!menuItems) {
    return;
  }

  var menuParams = {
    parent: appCtxt.getShell(),
    menuItems: menuItems,
    context: this._appName,
    controller: this
  };
  this._actionMenu = new ZmActionMenu(menuParams);
  this._addMenuListeners(this._actionMenu);
  // if (appCtxt.get(ZmSetting.TAGGING_ENABLED)) {
  //   this._setupTagMenu(this._actionMenu);
  // }
};

OwnCloudListView.prototype._addMenuListeners = function (menu) {
  var menuItems = menu.opList;
  for (var i = 0; i < menuItems.length; i++) {
    var menuItem = menuItems[i];
    if (this._listeners[menuItem]) {
      menu.addSelectionListener(menuItem, this._listeners[menuItem], 0);
    }
  }
  menu.addPopdownListener(this._menuPopdownListener);
};

OwnCloudListView.prototype._getActionMenuOps = function() {
  return [
    ZmOperation.SAVE_FILE,
    ZmOperation.RENAME_FILE,
    ZmOperation.RENAME_FOLDER,
    ZmOperation.NEW_FOLDER,
    ZmOperation.DELETE,
    ZmOperation.SEP,
    ZmOperation.SEND_FILE,
    ZmOperation.SEND_FILE_AS_ATT,
  ];
};

OwnCloudListView.prototype._sendFileListener = function(ev) {
  var
    /** @type {DavResource[]} */ resourcesToLink = this.getSelection(),
    /** @type {DavResource[]} */ resourcesToAttach = [],
    /** @type {string[]} */  resNames = [];

  for (var i = 0; i < resourcesToLink.length; i+= 1) {
    resNames.push(resourcesToLink[i].getName());
  }

  this._ocCommons.getAttachments(
    resourcesToLink,
    resourcesToAttach,
    new AjxCallback(
      this,
      this._sendFilesListCbk,
      [resNames]
    )
  );
};

OwnCloudListView.prototype._sendFileAsAttachmentListener = function(ev) {
  var
    /** @type {DavResource[]} */ selectedResources = this.getSelection(),
    /** @type {DavResource[]} */ resourcesToLink = [],
    /** @type {DavResource[]} */ resourcesToAttach = [],
    /** @type {string[]} */  resNames = [];

  for (var i = 0; i < selectedResources.length; i += 1) {
    resNames.push(selectedResources[i].getName());
    if (selectedResources[i].isDirectory()) {
      resourcesToLink.push(selectedResources[i]);
    } else {
      resourcesToAttach.push(selectedResources[i]);
    }
  }

  this._ocCommons.getAttachments(
    resourcesToLink,
    resourcesToAttach,
    new AjxCallback(
      this,
      this._sendFilesListCbk,
      [resNames]
    )
  );
};

OwnCloudListView.prototype._sendFilesListCbk = function(resNames, urls, idsToAttach) {
  var cc = AjxDispatcher.run("GetComposeController"),
    htmlCompose = appCtxt.get(ZmSetting.COMPOSE_AS_FORMAT) === ZmSetting.COMPOSE_HTML,
    extraBodyText = [];

  for (var i = 0; i < urls.length; i+= 1) {
    extraBodyText.push(urls[i].name + ": " + urls[i].link);
  }

  cc._setView({
    action: ZmOperation.NEW_MESSAGE,
    inNewWindow: false,
    msg: new ZmMailMsg(),
    subjOverride: new AjxListFormat().format(resNames),
    extraBodyText: extraBodyText.join(htmlCompose ? "<br>" : "\n")
  });
  cc.saveDraft(ZmComposeController.DRAFT_TYPE_MANUAL, [].concat(idsToAttach).join(","));
};

OwnCloudListView.prototype._onItemSelected = function(ev) {
  var item = ev.item;

  var davResource = this.getSelection()[0];
  if(!item.isDirectory() && davResource._href.match(/\.pdf$|\.jpg$|\.jpeg$|\.png$|\.txt$/i))
  {
     this._davConnector.getDownloadLink(
       davResource.getHref(),
       new AjxCallback(this, this.preview, [davResource])
     );
  }

  if (ev.detail === DwtListView.ITEM_DBL_CLICKED) {
    if (item.isDirectory()) {
      //if (typeof this._onFolderSelectedCbk !== "undefined") {
      //  this._onFolderSelectedCbk.run(item);
      //}
    } else {
      this._saveFileListener(ev);
    }
  }
};

OwnCloudListView.prototype.preview = function(davResource, token) {
  var href = token + "&name=" + davResource.getName() + "&contentType=" + davResource.getContentType() + "&inline=true";
  document.getElementById('WebDAVPreview').src=href;
};


OwnCloudListView.prototype._saveFileListener = function(ev) {
  var davResource = this.getSelection()[0];
  this._davConnector.getDownloadLink(
    davResource.getHref(),
    new AjxCallback(this, this.downloadFromLink, [davResource])
  );
};

OwnCloudListView.prototype._deleteListener = function(ev) {
  var davResource = this.getSelection()[0],
    deleteDialog = new DwtMessageDialog({
      parent: appCtxt.getShell(),
      buttons: [DwtDialog.YES_BUTTON, DwtDialog.NO_BUTTON]
    });
  deleteDialog.setMessage(
    (ZmMsg.confirmDeleteForever).replace(/{0,.*,1#|\|2#.*\}/g,""),
    DwtMessageDialog.WARNING_STYLE,
    ZmMsg.remove + " " + davResource.getName()
  );
  deleteDialog.setButtonListener(DwtDialog.YES_BUTTON, new AjxListener(this, this._deleteCallback, [davResource, deleteDialog]));
  deleteDialog.addEnterListener(new AjxListener(this, this._deleteCallback, [davResource, deleteDialog]));
  deleteDialog.popup();
};

OwnCloudListView.prototype._deleteCallback = function(davResource, dialog) {
  this._davConnector.rm(
    davResource.getHref(),
    new AjxCallback(this, function(davResource, dialog, response) {
      this._ocZimletApp.refreshView();
      dialog.popdown();
    }, [davResource, dialog]),
    new AjxCallback(this, function(davResource, dialog, response) {
      this._ocZimletApp.refreshView();
      dialog.popdown();      
    }, [davResource, dialog])
  );
};

OwnCloudListView.prototype._renameFileListener = function() {
  var renameFileDialog = new DwtDialog({parent: appCtxt.getShell()}),
    folder = this.getSelection()[0],
    composite = new DwtComposite({ parent: renameFileDialog }),
    label,
    input;

  renameFileDialog.setView(composite);

  label = new DwtLabel({
    parent: composite
  });
  label.setText(ZmMsg.newName + ":");

  input = new DwtInputField({
    parent: composite,
    hint: folder.getName()
  });
  renameFileDialog.setTitle(ZmMsg.rename + ": " + folder.getName());
  renameFileDialog.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._renameFileCallback, [folder, input, renameFileDialog]));
  renameFileDialog.addEnterListener(new AjxListener(this, this._renameFileCallback, [folder, input, renameFileDialog]));
  //add tab group and focus on the input field
  renameFileDialog._tabGroup.addMemberBefore(input,renameFileDialog._tabGroup.getFirstMember());
  renameFileDialog._tabGroup.setFocusMember(input);  
  renameFileDialog.popup();
};

OwnCloudListView.prototype._renameFileCallback = function(file, input, dialog, ev) {
  if (input.getValue() === file.getName()) { return; }
  dialog.getButton(DwtDialog.OK_BUTTON).setEnabled(false);
  dialog.getButton(DwtDialog.CANCEL_BUTTON).setEnabled(false);

  this._davConnector.move(
    file.getHref(),
    file.getPath() + "/" + input.getValue(),
    false,
    new AjxCallback(this, function(dialog, result) {
      this._ocZimletApp.refreshView();
      dialog.popdown();      
      if (result === true) {
      } else {
      }
    }, [dialog]),
    new AjxCallback(this, function(dialog) {
      this._ocZimletApp.refreshView();
      dialog.popdown();      
    }, [dialog])
  );
};

OwnCloudListView.prototype._renameFolderListener = function(ev) {
  var renameFolderDialog = new DwtDialog({parent: appCtxt.getShell()}),
    folder = this.getSelection()[0],
    composite = new DwtComposite({ parent: renameFolderDialog }),
    label,
    input;

  renameFolderDialog.setView(composite);

  label = new DwtLabel({
    parent: composite
  });
  label.setText(ZmMsg.newName + ":");

  input = new DwtInputField({
    parent: composite,
    hint: folder.getName()
  });
  renameFolderDialog.setTitle(ZmMsg.renameFolder + ": " + folder.getName());
  renameFolderDialog.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._renameFolderCallback, [folder, input, renameFolderDialog]));
  renameFolderDialog.addEnterListener(new AjxListener(this, this._renameFolderCallback, [folder, input, renameFolderDialog]));
  //add tab group and focus on the input field
  renameFolderDialog._tabGroup.addMemberBefore(input,	renameFolderDialog._tabGroup.getFirstMember());
  renameFolderDialog._tabGroup.setFocusMember(input);  
  renameFolderDialog.popup();
};

OwnCloudListView.prototype._renameFolderCallback = function(folder, input, dialog, ev) {
  if (input.getValue() === folder.getName()) { return; }
  dialog.getButton(DwtDialog.OK_BUTTON).setEnabled(false);
  dialog.getButton(DwtDialog.CANCEL_BUTTON).setEnabled(false);

  this._davConnector.move(
    folder.getHref(),
    folder.getPath() + "/" + input.getValue() + "/",
    false,
    new AjxCallback(this, function(dialog, result) {
      this._ocZimletApp.refreshView();
      dialog.popdown();      
      if (result === true) {
      } else {
      }
    }, [dialog]),
    new AjxCallback(this, function(dialog) {
      this._ocZimletApp.refreshView();
      dialog.popdown();
    }, [dialog])
  );
};

OwnCloudListView.prototype._newFolderListener = function(ev) {
  var newFolderDialog = new DwtDialog({parent: appCtxt.getShell()}),
    folder = this.getSelection()[0],
    composite = new DwtComposite({ parent: newFolderDialog }),
    label,
    input;

  newFolderDialog.setView(composite);

  label = new DwtLabel({
    parent: composite
  });
  label.setText(ZmMsg.newFolder + ":");

  input = new DwtInputField({
    parent: composite
  });
  newFolderDialog.setTitle(ZmMsg.newFolder);
  newFolderDialog.setButtonListener(DwtDialog.OK_BUTTON, new AjxListener(this, this._newFolderCallback, [folder, input, newFolderDialog]));
  newFolderDialog.addEnterListener(new AjxListener(this, this._newFolderCallback, [folder, input, newFolderDialog]));
  //add tab group and focus on the input field
  newFolderDialog._tabGroup.addMemberBefore(input,	newFolderDialog._tabGroup.getFirstMember());
  newFolderDialog._tabGroup.setFocusMember(input);  
  newFolderDialog.popup();
};

OwnCloudListView.prototype._newFolderCallback = function(folder, input, dialog, ev) {
  var inputValue = ownCloudZimlet.prototype.sanitizeFileName(input.getValue());
  if (inputValue === folder.getName()) { return; }
  dialog.getButton(DwtDialog.OK_BUTTON).setEnabled(false);
  dialog.getButton(DwtDialog.CANCEL_BUTTON).setEnabled(false);

  this._davConnector.mkcol(
    "/"+(folder.getHref() + inputValue).replace(tk_barrydegraaff_owncloud_zimlet_HandlerObject.settings['owncloud_zimlet_server_path'], ""),
    new AjxCallback(this, function(dialog, result) {
      this._ocZimletApp.refreshView();
      dialog.popdown();
    }, [dialog])
  );  
};


OwnCloudListView.prototype.downloadFromLink = function(davResource, token) {
  var href = token + "&name=" + davResource.getName() + "&contentType=" + davResource.getContentType();
  
  // for non-IE
  if (typeof window.ActiveXObject === "undefined") {
    var save = document.createElement("a");
    save.href = href;
    save.target = "_blank";
    save.download = davResource.getName();

    var event = document.createEvent("MouseEvents");
    event.initEvent("click", true, true);
    save.dispatchEvent(event);
    (window.URL || window.webkitURL).revokeObjectURL(save.href);
  }
  // for IE
  else if ( !! window.ActiveXObject && document.execCommand)     {
    var _window = window.open(href, "_blank");
    _window.document.close();
    _window.document.execCommand("SaveAs", true, davResource.getName());
    _window.close();
  }

};
