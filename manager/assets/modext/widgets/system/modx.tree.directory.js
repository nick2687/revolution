/**
 * Generates the Directory Tree
 *
 * @class MODx.tree.Directory
 * @extends MODx.tree.Tree
 * @param {Object} config An object of options.
 * @xtype modx-tree-directory
 */
MODx.tree.Directory = function(config) {
    config = config || {};
    config.id = config.id || Ext.id();
    Ext.applyIf(config,{
        rootVisible: true
        ,rootName: 'Filesystem'
        ,rootId: '/'
        ,title: _('files')
        ,ddAppendOnly: false
        ,enableDrag: true
        ,enableDrop: true
        ,ddGroup: 'modx-treedrop-dd'
        ,url: MODx.config.connector_url
        ,hideSourceCombo: false
        ,baseParams: {
            hideFiles: config.hideFiles || false
            ,wctx: MODx.ctx || 'web'
            ,currentAction: MODx.request.a || 0
            ,currentFile: MODx.request.file || ''
            ,source: config.source || 0
        }
        ,action: 'browser/directory/getList'
        ,primaryKey: 'dir'
        ,useDefaultToolbar: true
        ,tbar: [{
            icon: MODx.config.manager_url+'templates/default/images/restyle/icons/folder.png'
            ,cls: 'x-btn-icon'
            ,tooltip: {text: _('file_folder_create')}
            ,handler: this.createDirectory
            ,scope: this
            ,hidden: MODx.perm.directory_create ? false : true
        },{
            icon: MODx.config.manager_url+'templates/default/images/restyle/icons/page_white.png'
            ,cls: 'x-btn-icon'
            ,tooltip: {text: _('file_create')}
            ,handler: this.createFile
            ,scope: this
            ,hidden: MODx.perm.file_create ? false : true
        },{
            icon: MODx.config.manager_url+'templates/default/images/restyle/icons/file_upload.png'
            ,cls: 'x-btn-icon'
            ,tooltip: {text: _('upload_files')}
            ,handler: this.uploadFiles
            ,scope: this
            ,hidden: MODx.perm.file_upload ? false : true
        },'->',{
            icon: MODx.config.manager_url+'templates/default/images/restyle/icons/file_manager.png'
            ,cls: 'x-btn-icon'
            ,tooltip: {text: _('modx_browser')}
            ,handler: this.loadFileManager
            ,scope: this
            ,hidden: MODx.perm.file_manager && !MODx.browserOpen ? false : true
        }]
        ,tbarCfg: {
            id: config.id+'-tbar'
        }
    });
    MODx.tree.Directory.superclass.constructor.call(this,config);
    this.addEvents({
        'beforeUpload': true
        ,'afterUpload': true
        ,'fileBrowserSelect': true
        ,'changeSource': true
    });
    this.on('click',function(n,e) {
        n.select();
        this.cm.activeNode = n;
    },this);
    this.on('render',function() {
        var el = Ext.get(this.config.id);
        el.createChild({tag: 'div', id: this.config.id+'_tb'});
        el.createChild({tag: 'div', id: this.config.id+'_filter'});
        this.addSourceToolbar();

//        this.getRootNode().pseudoroot = true
//        console.log(this.getRootNode())

    },this);
    this.addSourceToolbar();
    this.on('show',function() {
        if (!this.config.hideSourceCombo) {
            try { this.sourceCombo.show(); } catch (e) {}
        }
    },this);
};
Ext.extend(MODx.tree.Directory,MODx.tree.Tree,{

    windows: {}

    ,addSourceToolbar: function() {
        this.sourceCombo = new MODx.combo.MediaSource({
            value: this.config.source || MODx.config.default_media_source
            ,listeners: {
                'select':{fn:this.changeSource,scope:this}
            }
        });
        this.searchBar = new Ext.Toolbar({
            renderTo: this.tbar
            ,id: this.config.id+'-sourcebar'
            ,items: [this.sourceCombo]
        });
        this.on('resize', function(){
            this.sourceCombo.setWidth(this.getWidth() - 12);
        }, this);
        if (this.config.hideSourceCombo) {
            try { this.sourceCombo.hide(); } catch (e) {}
        }
    }

    ,changeSource: function(sel) {
        var s = sel.getValue();
        var rn = this.getRootNode();
        if (rn) { rn.setText(sel.getRawValue()); }
        this.config.baseParams.source = s;
        this.fireEvent('changeSource',s);
        this.refresh();
    }

    ,_initExpand: function() {
        var treeState;
        if (!Ext.isEmpty(this.config.openTo)) {
            treeState = Ext.state.Manager.get(this.treestate_id);
            this.selectPath('/'+_('files')+'/'+this.config.openTo,'text');
        } else {
            treeState = Ext.state.Manager.get(this.treestate_id);
            this.selectPath(treeState,'text');
        }
    }

    ,_saveState: function(n) {
        var p = n.getPath('text');
        Ext.state.Manager.set(this.treestate_id,p);
    }

    ,_handleDrag: function(dropEvent) {
        var from = dropEvent.dropNode.attributes.id;
        var to = dropEvent.target.attributes.id;
        MODx.Ajax.request({
            url: this.config.url
            ,params: {
                source: this.config.baseParams.source
                ,from: from
                ,to: to
                ,action: this.config.sortAction || 'browser/directory/sort'
                ,point: dropEvent.point
            }
            ,listeners: {
                'success': {fn:function(r) {
                    var el = dropEvent.dropNode.getUI().getTextEl();
                    if (el) {Ext.get(el).frame();}
                    this.fireEvent('afterSort',{event:dropEvent,result:r});
                },scope:this}
                ,'failure': {fn:function(r) {
                    MODx.form.Handler.errorJSON(r);
                    this.refresh();
                    return false;
                },scope:this}
            }
        });
    }

    ,getPath:function(node) {
        var path, p, a;

        // get path for non-root node
        if(node !== this.root) {
            p = node.parentNode;
            a = [node.text];
            while(p && p !== this.root) {
                a.unshift(p.text);
                p = p.parentNode;
            }
            a.unshift(this.root.attributes.path || '');
            path = a.join(this.pathSeparator);
        }

        // path for root node is it's path attribute
        else {
            path = node.attributes.path || '';
        }

        // a little bit of security: strip leading / or .
        // full path security checking has to be implemented on server
        path = path.replace(/^[\/\.]*/, '');
        return path+'/';
    }

    ,editFile: function(itm,e) {
        this.loadAction('a=system/file/edit&file='+this.cm.activeNode.attributes.id+'&source='+this.config.source);
    }

    ,quickUpdateFile: function(itm,e) {
        var node = this.cm.activeNode;
        MODx.Ajax.request({
            url: MODx.config.connector_url
            ,params: {
                action: 'browser/file/get'
                ,file:  node.attributes.id
                ,wctx: MODx.ctx || ''
                ,source: this.getSource()
            }
            ,listeners: {
                'success': {fn:function(response) {
                    var r = {
                        file: node.attributes.id
                        ,name: node.text
                        ,path: node.attributes.pathRelative
                        ,source: this.getSource()
                        ,content: response.object.content
                    };
                    var w = MODx.load({
                        xtype: 'modx-window-file-quick-update'
                        ,record: r
                        ,listeners: {
                            'hide':{fn:function() {this.destroy();}}
                        }
                    });
                    w.show(e.target);
                },scope:this}
            }
        });
    }

    ,createFile: function(itm,e) {
        var d = this.cm.activeNode && this.cm.activeNode.attributes ? this.cm.activeNode.attributes.id : '';
        this.loadAction('a=system/file/create&directory='+d+'&source='+this.getSource());
    }

    ,quickCreateFile: function(itm,e) {
        var node = this.cm.activeNode;
        var r = {
            directory: node.attributes.id
            ,source: this.getSource()
        };
        var w = MODx.load({
            xtype: 'modx-window-file-quick-create'
            ,record: r
            ,listeners: {
                'success':{fn:this.refreshActiveNode,scope:this}
                ,'hide':{fn:function() {this.destroy();}}
            }
        });
        w.show(e.target);
    }

    ,browser: null

    ,loadFileManager: function(btn,e) {
        var refresh = false;
        if (this.browser === null) {
            this.browser = MODx.load({
                xtype: 'modx-browser'
                ,hideFiles: true
                ,rootVisible: false
                ,wctx: MODx.ctx
                ,source: this.config.baseParams.source
                ,listeners: {
                    'select': {fn: function(data) {
                        this.fireEvent('fileBrowserSelect',data);
                    },scope:this}
                }
            });
        } else {
            refresh = true;
        }
        if (this.browser) {
            this.browser.setSource(this.config.baseParams.source);
            if (refresh) {
                this.browser.win.tree.refresh();
            }
            this.browser.show();
        }
    }

    ,renameNode: function(field,nv,ov) {
        MODx.Ajax.request({
            url: MODx.config.connector_url
            ,params: {
                action: 'browser/file/rename'
                ,new_name: nv
                ,old_name: ov
                ,file: this.treeEditor.editNode.id
                ,wctx: MODx.ctx || ''
                ,source: this.getSource()
            }
            ,listeners: {
               'success': {fn:this.refreshActiveNode,scope:this}
            }
        });
    }

    ,renameDirectory: function(item,e) {
        var node = this.cm.activeNode;
        var r = {
            old_name: node.text
            ,name: node.text
            ,path: node.attributes.pathRelative
            ,source: this.getSource()
        };
        var w = MODx.load({
            xtype: 'modx-window-directory-rename'
            ,record: r
            ,listeners: {
                'success':{fn:this.refreshParentNode,scope:this}
                ,'hide':{fn:function() {this.destroy();}}
            }
        });
        w.show(e.target);
    }

    ,renameFile: function(item,e) {
        var node = this.cm.activeNode;
        var r = {
            old_name: node.text
            ,name: node.text
            ,path: node.attributes.pathRelative
            ,source: this.getSource()
        };
        var w = MODx.load({
            xtype: 'modx-window-file-rename'
            ,record: r
            ,listeners: {
                'success':{fn:this.refreshParentNode,scope:this}
                ,'hide':{fn:function() {this.destroy();}}
            }
        });
        w.show(e.target);
    }

    ,createDirectory: function(item,e) {
        var node = this.cm && this.cm.activeNode ? this.cm.activeNode : false;
        var r = {
            'parent': node && node.attributes.type == 'dir' ? node.attributes.pathRelative : '/'
            ,source: this.getSource()
        };
        var w = MODx.load({
            xtype: 'modx-window-directory-create'
            ,record: r
            ,listeners: {
                'success':{fn:this.refreshActiveNode,scope:this}
                ,'hide':{fn:function() {this.destroy();}}
            }
        });
        w.show(e ? e.target : Ext.getBody());
    }

    ,chmodDirectory: function(item,e) {
        var node = this.cm.activeNode;
        var r = {
            dir: node.attributes.path
            ,mode: node.attributes.perms
            ,source: this.getSource()
        };
        var w = MODx.load({
            xtype: 'modx-window-directory-chmod'
            ,record: r
            ,listeners: {
                'success':{fn:this.refreshActiveNode,scope:this}
                ,'hide':{fn:function() {this.destroy();}}
            }
        });
        w.show(e.target);
    }

    ,removeDirectory: function(item,e) {
        var node = this.cm.activeNode;
        MODx.msg.confirm({
            text: _('file_folder_remove_confirm')
            ,url: MODx.config.connector_url
            ,params: {
                action: 'browser/directory/remove'
                ,dir: node.attributes.path
                ,wctx: MODx.ctx || ''
                ,source: this.getSource()
            }
            ,listeners: {
                'success':{fn:this.refreshParentNode,scope:this}
            }
        });
    }

    ,removeFile: function(item,e) {
        var node = this.cm.activeNode;
        MODx.msg.confirm({
            text: _('file_confirm_remove')
            ,url: MODx.config.connector_url
            ,params: {
                action: 'browser/file/remove'
                ,file: node.attributes.id
                ,wctx: MODx.ctx || ''
                ,source: this.getSource()
            }
            ,listeners: {
                'success':{fn:this.refreshParentNode,scope:this}
            }
        });
    }

    ,downloadFile: function(item,e) {
        var node = this.cm.activeNode;
        MODx.Ajax.request({
            url: MODx.config.connector_url
            ,params: {
                action: 'browser/file/download'
                ,file: node.attributes.id
                ,wctx: MODx.ctx || ''
                ,source: this.getSource()
            }
            ,listeners: {
                'success':{fn:function(r) {
                    if (!Ext.isEmpty(r.object.url)) {
                        location.href = MODx.config.connector_url+'?action=browser/file/download&download=1&file='+node.attributes.id+'&HTTP_MODAUTH='+MODx.siteId+'&source='+this.getSource()+'&wctx='+MODx.ctx;
                    }
                },scope:this}
            }
        });
    }

    ,getSource: function() {
        return this.config.baseParams.source;
    }

    ,uploadFiles: function(btn,e) {
        if (!this.uploader) {
            this.uploader = new Ext.ux.UploadDialog.Dialog({
                url: MODx.config.connector_url
                ,base_params: {
                    action: 'browser/file/upload'
                    ,wctx: MODx.ctx || ''
                    ,source: this.getSource()
                }
                ,reset_on_hide: true
                ,width: 550
                ,cls: 'ext-ux-uploaddialog-dialog modx-upload-window'
            });
            this.uploader.on('show',this.beforeUpload,this);
            this.uploader.on('uploadsuccess',this.uploadSuccess,this);
            this.uploader.on('uploaderror',this.uploadError,this);
            this.uploader.on('uploadfailed',this.uploadFailed,this);
        }
        this.uploader.base_params.source = this.getSource();
        this.uploader.show(btn);
    }

    ,uploadError: function(dlg,file,data,rec) {}

    ,uploadFailed: function(dlg,file,rec) {}

    ,uploadSuccess:function() {
        if (this.cm.activeNode) {
            var node = this.cm.activeNode;
            if (node.isLeaf) {
                var pn = (node.isLeaf() ? node.parentNode : node);
                if (pn) {
                    pn.reload();
                } else {
                    this.refreshActiveNode();
                }
                this.fireEvent('afterUpload',node);
            } else {
                this.refreshActiveNode();
            }
        } else {
            this.refresh();
            this.fireEvent('afterUpload');
        }
    }

    ,beforeUpload: function() {
        var path;
        if (this.cm.activeNode) {
            path = this.getPath(this.cm.activeNode);
            if(this.cm.activeNode.isLeaf()) {
                path = this.getPath(this.cm.activeNode.parentNode);
            }
        } else { path = '/'; }

        this.uploader.setBaseParams({
            action: 'browser/file/upload'
            ,path: path
            ,wctx: MODx.ctx || ''
            ,source: this.getSource()
        });
        this.fireEvent('beforeUpload',this.cm.activeNode);
    }

});
Ext.reg('modx-tree-directory',MODx.tree.Directory);

/**
 * Generates the Create Directory window
 *
 * @class MODx.window.CreateDirectory
 * @extends MODx.Window
 * @param {Object} config An object of configuration options.
 * @xtype modx-window-directory-create
 */
MODx.window.CreateDirectory = function(config) {
    config = config || {};
    Ext.applyIf(config,{
        width: 430
        ,height: 200
        ,title: _('file_folder_create')
        ,url: MODx.config.connector_url
        ,action: 'browser/directory/create'
        ,fields: [{
            xtype: 'hidden'
            ,name: 'wctx'
            ,value: MODx.ctx || ''
        },{
            xtype: 'hidden'
            ,name: 'source'
        },{
            fieldLabel: _('name')
            ,name: 'name'
            ,xtype: 'textfield'
            ,anchor: '100%'
            ,allowBlank: false
        },{
            fieldLabel: _('file_folder_parent')
            ,name: 'parent'
            ,xtype: 'textfield'
            ,anchor: '100%'
        }]
    });
    MODx.window.CreateDirectory.superclass.constructor.call(this,config);
};
Ext.extend(MODx.window.CreateDirectory,MODx.Window);
Ext.reg('modx-window-directory-create',MODx.window.CreateDirectory);

/**
 * Generates the Chmod Directory window
 *
 * @class MODx.window.ChmodDirectory
 * @extends MODx.Window
 * @param {Object} config An object of configuration options.
 * @xtype modx-window-directory-chmod
 */
MODx.window.ChmodDirectory = function(config) {
    config = config || {};
    Ext.applyIf(config,{
        title: _('file_folder_chmod')
        ,width: 430
        ,height: 200
        ,url: MODx.config.connector_url
        ,action: 'browser/directory/chmod'
        ,fields: [{
            xtype: 'hidden'
            ,name: 'wctx'
            ,value: MODx.ctx || ''
        },{
            xtype: 'hidden'
            ,name: 'source'
        },{
            name: 'dir'
            ,fieldLabel: _('name')
            ,xtype: 'statictextfield'
            ,anchor: '100%'
            ,submitValue: true
        },{
            fieldLabel: _('mode')
            ,name: 'mode'
            ,xtype: 'textfield'
            ,anchor: '100%'
            ,allowBlank: false
        }]
    });
    MODx.window.ChmodDirectory.superclass.constructor.call(this,config);
};
Ext.extend(MODx.window.ChmodDirectory,MODx.Window);
Ext.reg('modx-window-directory-chmod',MODx.window.ChmodDirectory);

/**
 * Generates the Rename Directory window
 *
 * @class MODx.window.RenameDirectory
 * @extends MODx.Window
 * @param {Object} config An object of configuration options.
 * @xtype modx-window-directory-rename
 */
MODx.window.RenameDirectory = function(config) {
    config = config || {};
    Ext.applyIf(config,{
        title: _('rename')
        ,width: 430
        ,height: 200
        ,url: MODx.config.connector_url
        ,action: 'browser/directory/rename'
        ,fields: [{
            xtype: 'hidden'
            ,name: 'wctx'
            ,value: MODx.ctx || ''
        },{
            xtype: 'hidden'
            ,name: 'source'
        },{
            fieldLabel: _('path')
            ,name: 'path'
            ,xtype: 'statictextfield'
            ,submitValue: true
            ,anchor: '100%'
        },{
            fieldLabel: _('old_name')
            ,name: 'old_name'
            ,xtype: 'statictextfield'
            ,anchor: '100%'
        },{
            fieldLabel: _('new_name')
            ,name: 'name'
            ,xtype: 'textfield'
            ,anchor: '100%'
            ,allowBlank: false
        }]
    });
    MODx.window.RenameDirectory.superclass.constructor.call(this,config);
};
Ext.extend(MODx.window.RenameDirectory,MODx.Window);
Ext.reg('modx-window-directory-rename',MODx.window.RenameDirectory);

/**
 * Generates the Rename File window
 *
 * @class MODx.window.RenameFile
 * @extends MODx.Window
 * @param {Object} config An object of configuration options.
 * @xtype modx-window-file-rename
 */
MODx.window.RenameFile = function(config) {
    config = config || {};
    Ext.applyIf(config,{
        title: _('rename')
        ,width: 430
        ,height: 200
        ,url: MODx.config.connector_url
        ,action: 'browser/file/rename'
        ,fields: [{
            xtype: 'hidden'
            ,name: 'wctx'
            ,value: MODx.ctx || ''
        },{
            xtype: 'hidden'
            ,name: 'source'
        },{
            fieldLabel: _('path')
            ,name: 'path'
            ,xtype: 'statictextfield'
            ,submitValue: true
            ,anchor: '100%'
        },{
            fieldLabel: _('old_name')
            ,name: 'old_name'
            ,xtype: 'statictextfield'
            ,anchor: '100%'
        },{
            fieldLabel: _('new_name')
            ,name: 'name'
            ,xtype: 'textfield'
            ,anchor: '100%'
            ,allowBlank: false
        },{
            name: 'dir'
            ,xtype: 'hidden'
        }]
    });
    MODx.window.RenameFile.superclass.constructor.call(this,config);
};
Ext.extend(MODx.window.RenameFile,MODx.Window);
Ext.reg('modx-window-file-rename',MODx.window.RenameFile);

/**
 * Generates the Quick Update File window
 *
 * @class MODx.window.QuickUpdateFile
 * @extends MODx.Window
 * @param {Object} config An object of configuration options.
 * @xtype modx-window-file-quick-update
 */
MODx.window.QuickUpdateFile = function(config) {
    config = config || {};
    Ext.applyIf(config,{
        title: _('file_quick_update')
        ,width: 600
        ,height: 640
        ,autoHeight: false
        ,layout: 'anchor'
        ,url: MODx.config.connector_url
        ,action: 'browser/file/update'
        ,fields: [{
            xtype: 'hidden'
            ,name: 'wctx'
            ,value: MODx.ctx || ''
        },{
            xtype: 'hidden'
            ,name: 'source'
        },{
            xtype: 'hidden'
            ,name: 'file'
        },{
            fieldLabel: _('name')
            ,name: 'name'
            ,xtype: 'statictextfield'
            ,anchor: '100%'
        },{
            fieldLabel: _('path')
            ,name: 'path'
            ,xtype: 'statictextfield'
            ,anchor: '100%'
        },{
            fieldLabel: _('content')
            ,xtype: 'textarea'
            ,name: 'content'
            ,anchor: '100% -118'
        }]
       ,keys: [{
            key: Ext.EventObject.ENTER
            ,shift: true
            ,fn: this.submit
            ,scope: this
        }]
        ,buttons: [{
            text: config.cancelBtnText || _('cancel')
            ,scope: this
            ,handler: function() { this.hide(); }
        },{
            text: config.saveBtnText || _('save')
            ,scope: this
            ,handler: function() { this.submit(false); }
        },{
            text: config.saveBtnText || _('save_and_close')
            ,scope: this
            ,handler: this.submit
        }]
    });
    MODx.window.QuickUpdateFile.superclass.constructor.call(this,config);
};
Ext.extend(MODx.window.QuickUpdateFile,MODx.Window);
Ext.reg('modx-window-file-quick-update',MODx.window.QuickUpdateFile);

/**
 * Generates the Quick Create File window
 *
 * @class MODx.window.QuickCreateFile
 * @extends MODx.Window
 * @param {Object} config An object of configuration options.
 * @xtype modx-window-file-quick-create
 */
MODx.window.QuickCreateFile = function(config) {
    config = config || {};
    Ext.applyIf(config,{
        title: _('file_quick_create')
        ,width: 600
        ,height: 640
        ,autoHeight: false
        ,layout: 'anchor'
        ,url: MODx.config.connector_url
        ,action: 'browser/file/create'
        ,fields: [{
            xtype: 'hidden'
            ,name: 'wctx'
            ,value: MODx.ctx || ''
        },{
            xtype: 'hidden'
            ,name: 'source'
        },{
            fieldLabel: _('directory')
            ,name: 'directory'
            ,submitValue: true
            ,xtype: 'statictextfield'
            ,anchor: '100%'
        },{
            fieldLabel: _('name')
            ,name: 'name'
            ,xtype: 'textfield'
            ,anchor: '100%'
            ,allowBlank: false
        },{
            fieldLabel: _('content')
            ,xtype: 'textarea'
            ,name: 'content'
            ,anchor: '100% -120'
        }]
       ,keys: [{
            key: Ext.EventObject.ENTER
            ,shift: true
            ,fn: this.submit
            ,scope: this
        }]
        ,buttons: [{
            text: config.cancelBtnText || _('cancel')
            ,scope: this
            ,handler: function() { this.hide(); }
        },{
            text: config.saveBtnText || _('save')
            ,scope: this
            ,handler: this.submit
        }]
    });
    MODx.window.QuickCreateFile.superclass.constructor.call(this,config);
};
Ext.extend(MODx.window.QuickCreateFile,MODx.Window);
Ext.reg('modx-window-file-quick-create',MODx.window.QuickCreateFile);


