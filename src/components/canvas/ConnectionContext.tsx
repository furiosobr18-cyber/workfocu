import React, { createContext, useContext, useState, useCallback } from "react";

export interface CanvasConnection {
  id: string;
  sourceId: string; // YouTube/Image/File shape ID
  sourceType: string;
  targetId: string; // Chat shape ID
}

interface ConnectionContextType {
  connections: CanvasConnection[];
  linkingFrom: { id: string; type: string } | null;
  startLinking: (sourceId: string, sourceType: string) => void;
  completeLinking: (targetId: string) => void;
  cancelLinking: () => void;
  removeConnection: (connectionId: string) => void;
  getConnectionsForChat: (chatId: string) => CanvasConnection[];
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

export function useConnections() {
  const ctx = useContext(ConnectionContext);
  if (!ctx) throw new Error("useConnections must be inside ConnectionProvider");
  return ctx;
}

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [connections, setConnections] = useState<CanvasConnection[]>([]);
  const [linkingFrom, setLinkingFrom] = useState<{ id: string; type: string } | null>(null);

  const startLinking = useCallback((sourceId: string, sourceType: string) => {
    setLinkingFrom({ id: sourceId, type: sourceType });
  }, []);

  const completeLinking = useCallback((targetId: string) => {
    if (!linkingFrom) return;
    // Don't duplicate
    const exists = connections.some(
      (c) => c.sourceId === linkingFrom.id && c.targetId === targetId
    );
    if (!exists) {
      setConnections((prev) => [
        ...prev,
        {
          id: `${linkingFrom.id}-${targetId}`,
          sourceId: linkingFrom.id,
          sourceType: linkingFrom.type,
          targetId,
        },
      ]);
    }
    setLinkingFrom(null);
  }, [linkingFrom, connections]);

  const cancelLinking = useCallback(() => {
    setLinkingFrom(null);
  }, []);

  const removeConnection = useCallback((connectionId: string) => {
    setConnections((prev) => prev.filter((c) => c.id !== connectionId));
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
      }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}
