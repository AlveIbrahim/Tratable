import { create } from "zustand";

/**
 * Grid focus/selection as an explicit state machine, not ad-hoc DOM focus
 * tracking. `mode: "nav"` means the cell is highlighted but not editing —
 * arrow keys move the active cell. `mode: "edit"` means the cell's editor
 * is mounted and has keyboard focus — arrow keys move within the input
 * instead (the editor component decides that, not this store).
 */
interface GridState {
  activeRowId: string | null;
  activeFieldId: string | null;
  mode: "nav" | "edit";
  setActive: (rowId: string | null, fieldId: string | null) => void;
  startEditing: () => void;
  stopEditing: () => void;
}

export const useGridStore = create<GridState>((set) => ({
  activeRowId: null,
  activeFieldId: null,
  mode: "nav",
  setActive: (rowId, fieldId) => set({ activeRowId: rowId, activeFieldId: fieldId, mode: "nav" }),
  startEditing: () => set({ mode: "edit" }),
  stopEditing: () => set({ mode: "nav" }),
}));
