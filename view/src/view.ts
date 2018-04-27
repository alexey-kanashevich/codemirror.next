import {EditorState, Transaction} from "../../state/src/state"
import {DocViewDesc} from "./viewdesc"
import {DOMObserver} from "./domobserver"
import {attachEventHandlers} from "./input"
import {SelectionReader, selectionToDOM} from "./selection"

export class EditorView {
  private _state: EditorState;
  get state(): EditorState { return this._state }

  private _props: EditorProps;
  get props(): EditorProps { return this._props }

  private _root: Document | null = null;

  public dispatch: (tr: Transaction) => void;

  public dom: Element;
  public contentDOM: Element;

  // (Many of these things should be module-private)

  public docView: DocViewDesc;
  public domObserver: DOMObserver;
  public selectionReader: SelectionReader;

  constructor(state: EditorState, props: EditorProps = {}, dispatch: ((tr: Transaction) => void) | undefined = undefined) {
    this._state = state
    this._props = props
    this.dispatch = dispatch || (tr => this.setState(tr.apply()))

    this.contentDOM = document.createElement("pre")
    this.contentDOM.className = "CM-content"
    this.contentDOM.setAttribute("contenteditable", "true")

    this.dom = document.createElement("div")
    this.dom.className = "CM"
    this.dom.appendChild(this.contentDOM)

    this.domObserver = new DOMObserver(this)
    attachEventHandlers(this)
    this.selectionReader = new SelectionReader(this)
    
    this.docView = new DocViewDesc(state.doc, this.contentDOM)
    this.domObserver.start()
  }

  setState(state: EditorState) {
    let prev = this.state
    this._state = state
    let updateDOM = state.doc != prev.doc || this.docView.dirtyRanges.length
    let updateSel = updateDOM || !prev.selection.eq(state.selection)
    if (updateSel) {
      this.selectionReader.ignoreUpdates = true
      if (updateDOM) {
        this.domObserver.stop()
        this.docView.update(state.doc)
        this.domObserver.start()
        this.selectionReader.clearDOMState()
      }
      selectionToDOM(this)
      this.selectionReader.ignoreUpdates = false
    }
  }

  // FIXME can also return a DocumentFragment, but TypeScript doesn't
  // believe that has getSelection etc methods
  get root(): Document {
    let cached = this._root
    if (cached == null) {
      for (let search: any = this.dom.parentNode; search; search = search.parentNode) {
        if (search.nodeType == 9 || (search.nodeType == 11 && search.host))
          return this._root = search
      }
    }
    return document
  }

  hasFocus(): boolean {
    return this.root.activeElement == this.contentDOM
  }

  focus() {
    selectionToDOM(this, true)
  }

}

interface EditorProps {
  readonly handleDOMEvents?: {[key: string]: (view: EditorView, event: Event) => boolean};
}