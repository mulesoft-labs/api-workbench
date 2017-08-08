/**
 * Single context menu item.
 */
export interface IContextMenuItem {
    /**
     * CSS Selector, determining, to which html node item is applicable to.
     */
    selector : string

    /**
     * Displayable context menu item label
     */
    name : string

    /**
     * Optional item categories. In example, item with a name "itemName" and categories ["cat1", "cat2"]
     * will be displayed as the following menu hierarchy: cat1/cat2/itemName
     */
    categories? : string[]

    /**
     * Callback called when the item is clicked.
     * @param item - item that was clicked
     */
    onClick: (item? : IContextMenuItem)=>void

    /**
     * Children of this item
     */
    children : IContextMenuItem[]
}

/**
 * Contributes context menu items.
 * Is called before each menu display.
 */
export interface IContextMenuContributor {

    /**
     * Unique contributor id.
     */
    id : string

    /**
     * Calculates items to display in the context menu.
     * This is runtime method, called each time for each contributor before
     * the menu is displayed.
     */
    calculateItems () : Promise<IContextMenuItem[]>

    /**
     * Optionally notifies contributor that the menu is about to be displayed and
     * item calculations are started
     */
    calculationStarted? : ()=>void

    /**
     * Optionally notifies contributor that the menu is about to be displayed and
     * item calculations are done
     */
    calculationFinished? : ()=>void
}


