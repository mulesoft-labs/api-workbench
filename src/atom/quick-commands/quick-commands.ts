/// <reference path="../../../typings/main.d.ts" />
import qcui = require('./quick-commands-ui');
import atom = require('../core/atomWrapper');
// import contextActions = require("raml-actions")
import cc = require('./code-commands');
import et = require('../editor-tools/editor-tools');

/*
 * Quick command is a command object that stores command info, body and filtering function
 */
export class QuickCommand {
    constructor(
		public id: string,
        public title: string,
        public command: () => void,
		public priority: number,
        public when: () => boolean
    ) {}

	private atomCommand: AtomCore.Disposable;
	registerAsAtomCommand(target: string) {
		if (this.atomCommand && this.atomCommand.disposed == false) this.atomCommand.dispose();
		this.atomCommand = atom.commands.add(target, this.id, this.command);
	}

	dispose() {
		if (this.atomCommand && this.atomCommand.disposed == false) this.atomCommand.dispose();
		cm.unregister(this);
	}
}

/*
 * Command manager manages quick commands.
 * All quick commands should be registered here.
 * For usage example, see registerCommands
 */
export class CommandManager {
	private commands = {};
    private panel = new qcui.SelectListView<QuickCommand>(command => command.command(), command => command.title, 'title');

	register(cmd: QuickCommand) {
		if (this.commands[cmd.id] != null) this.unregister(cmd.id);
		this.commands[cmd.id] = cmd;
		return cmd;
	}

	unregister(cmd: string | QuickCommand) {
		if (typeof(cmd) == "string") this.unregister(this.commands[<string>cmd]);
		var qcmd = <QuickCommand> cmd;
		if (qcmd == null) return null;
		delete this.commands[qcmd.id];
		return qcmd;
	}

    add(id: string, title: string, command: ()=>void, when?:()=>boolean, priority?: number, atomTarget?: string) {
        var cmd = new QuickCommand(id, title, command, priority ? priority : 0,  when ? when : () => true);
        if (atomTarget) cmd.registerAsAtomCommand(atomTarget);
		this.register(cmd);
		return cmd;
    }

	show(predicate?: (cmd: QuickCommand) => boolean) {
		var joinedCommands : {[id:string]:QuickCommand} = {}

		for (var commandId in this.commands) {
			joinedCommands[commandId] = this.commands[commandId]
		}

		this.getDynamicCommands().forEach(currentCommand=>{
			joinedCommands[currentCommand.id] = currentCommand
		})

		var list = Object.keys(joinedCommands)
						.map(key=> <QuickCommand>joinedCommands[key])
						.sort((a, b) => b.priority - a.priority)
						.filter(cmd=> cmd.when());

		if (predicate) list = list.filter(predicate);
		this.panel.show(list);
	}

	getDynamicCommands() : QuickCommand[] {
		var result : QuickCommand[] = []
		// var currentActions = contextActions.calculateCurrentActions(contextActions.TARGET_RAML_EDITOR_NODE)
        //
		// currentActions.forEach(action => {
		// 	var convertedQuickCommand : QuickCommand = new QuickCommand(action.name,
		// 		action.label?action.label:action.name, action.onClick, 1, ()=>{return true})
        //
		// 	var cmd : any = convertedQuickCommand
		// 	cmd['__module__'] = 'editorTools'
		// 	result.push(convertedQuickCommand)
		// })

		return result
	}
}

var cm: CommandManager;

/*
 * Always return working copy of manager.
 */
export function manager() {
	if (!cm) cm = new CommandManager();
	return cm;
}

/*
 * function for RAML -> Show Quick Commands (^Q)
 */
export function showCommands() {
	manager().show();
}

/*
 * registerCommands is called at the plugin initialization for registering global commands
 */
export function registerCommands() {
	cc.registerQuickCommands(manager());
	cm.add('aml-workbench:editor-tools', 'Show Editor Tools', ()=>et.initEditorTools(), ()=>et.editorToolsStatus() == false);
}
