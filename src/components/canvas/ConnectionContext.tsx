import React, { createContext, useContext, useState, useCallback } from "react";

export interface CanvasConnection {
  id: string;
  sourceId: string;
  sourceType: string;
  targetId: string;
  pageId: string;
}

interface ConnectionContextType {
  connections: CanvasConnection[];
  linkingFrom: { id: string; type: string } | null;
  startLinking: (sourceId: string, sourceType: string) => void;
  completeLinking: (targetId: string) => void;
  cancelLinking: () => void;
  removeConnection: (connectionId: string) => void;
  getConnectionsForChat: (chatId: string) => CanvasConnection[];
  currentPageId: string;
  setCurrentPageId: (pageId: string) => void;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

export function useConnections() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnections must be inside ConnectionProvider");
  return ctx;
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [allConnections, setAllConnections] = useState<CanvasConnection[]>([]);
  const [linkingFrom, setLinkingFrom] = useState<{ id: string; type: string } | null>(null);
  const [currentPageId, setCurrentPageId] = useState<string>("page:page");

  // Only show connections for the current page
  const connections = allConnections.filter((c) => c.pageId === currentPageId);

  const startLinking = useCallback((sourceId: string, sourceType: string) => {
    setLinkingFrom({ id: sourceId, type: sourceType });
  }, []);

  const completeLinking = useCallback((targetId: string) => {
    if (!linkingFrom) return;
    const exists = allConnections.some(
      (c) => c.sourceId === linkingFrom.id && c.targetId === targetId && c.pageId === currentPageId
    );
    if (!exists) {
      setAllConnections((prev) => [
        ...prev,
        {
          id: `${linkingFrom.id}-${targetId}`,
          sourceId: linkingFrom.id,
          sourceType: linkingFrom.type,
          targetId,
          pageId: currentPageId,
        },
      ]);
    }
    setLinkingFrom(null);
  }, [linkingFrom, allConnections, currentPageId]);

  const cancelLinking = useCallback(() => {
    setLinkingFrom(null);
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setAllConnections((prev) => prev.filter((c) => c.id !== connectionId));
  }, []);

  const getConnectionsForChat = useCallback(
    (chatId: string) => connections.filter((c) => c.targetId === chatId),
    [connections]
  );

  return (
    <ConnectionContext.Provider
      value={{
        connections,
        linkingFrom,
        startLinking,
        completeLinking,
        cancelLinking,
        removeConnection,
        getConnectionsForChat,
        currentPageId,
        setCurrentPageId,
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}
