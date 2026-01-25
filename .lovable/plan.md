

## Plano: Esconder Campo "Nova Nota" Quando Editando Nota de um Cérebro

### Problema Identificado
Quando o usuário está no Segundo Cérebro, clica em uma nota para editar, ele vai para a visualização normal de notas onde aparece o campo "Nova nota..." na barra lateral esquerda. O usuário quer que esse campo seja escondido quando está editando uma nota que pertence a um cérebro.

### Solução
Verificar se a nota selecionada (`selectedNote`) pertence a um cérebro usando a função `getBrainForNote` do hook `useBrains`. Se pertencer, esconder o campo de criar nova nota.

### Mudanças em `src/pages/Notes.tsx`

#### 1. Adicionar `getBrainForNote` na desestruturação (linha 159-171)
```tsx
const {
  brains,
  createBrain,
  updateBrain,
  deleteBrain,
  addNoteToBrain,
  removeNoteFromBrain,
  getNotesInBrain,
  getLooseNoteIds,
  getBrainColor,
  getBrainForNote,  // ← Adicionar aqui
  getRootBrains,
  getChildBrains,
} = useBrains(user?.id);
```

#### 2. Verificar se nota selecionada pertence a cérebro (linhas 613-624)

**Antes:**
```tsx
<div className="flex gap-2">
  <Input
    placeholder="Nova nota..."
    value={newTitle}
    onChange={(e) => setNewTitle(e.target.value)}
    className="flex-1"
    onKeyDown={(e) => e.key === 'Enter' && createNote()}
  />
  <Button onClick={createNote} disabled={isCreating || !newTitle.trim()} size="icon">
    <Plus className="w-4 h-4" />
  </Button>
</div>
```

**Depois:**
```tsx
{/* Esconder "Nova nota" se a nota selecionada pertence a um cérebro */}
{!(selectedNote && getBrainForNote(selectedNote.id)) && (
  <div className="flex gap-2">
    <Input
      placeholder="Nova nota..."
      value={newTitle}
      onChange={(e) => setNewTitle(e.target.value)}
      className="flex-1"
      onKeyDown={(e) => e.key === 'Enter' && createNote()}
    />
    <Button onClick={createNote} disabled={isCreating || !newTitle.trim()} size="icon">
      <Plus className="w-4 h-4" />
    </Button>
  </div>
)}
```

### Comportamento Final
- Na aba Notas normal (sem nota selecionada): campo "Nova nota..." visivel
- Editando nota solta (sem cerebro): campo "Nova nota..." visivel
- Editando nota de um cerebro: campo "Nova nota..." **escondido**

### Arquivo a Modificar
- `src/pages/Notes.tsx`

