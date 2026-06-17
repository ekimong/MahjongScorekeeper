import { createContext, useContext, useState } from 'react';

const EditContext = createContext({ grantEdit: () => {}, canEdit: () => false });

export function EditProvider({ children }) {
  const [editableEvents, setEditableEvents] = useState(new Set());

  function grantEdit(eventId) {
    setEditableEvents((prev) => new Set([...prev, eventId]));
  }

  function canEdit(eventId) {
    return editableEvents.has(eventId);
  }

  return (
    <EditContext.Provider value={{ grantEdit, canEdit }}>
      {children}
    </EditContext.Provider>
  );
}

export function useEdit() {
  return useContext(EditContext);
}
