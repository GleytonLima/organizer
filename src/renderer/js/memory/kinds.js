// Tipos de memória: rótulos, ícones e o campo de texto de cada um (usado pela aba e pelos diálogos).
//   decision  uma frase com o porquê
//   note      fato, convenção, armadilha
//   idea      ideia que surgiu em paralelo; aberta até virar tarefa ou ser descartada
//   howto     "como fazer": como resolvemos, o procedimento, a quem recorrer
//   progress  estado de uma tarefa para retomar (criado pela tarefa, não por aqui)
export const KINDS = {
  decision: {
    label: 'Decisão', plural: 'Decisões', icon: 'decision', newTitle: 'Nova decisão', editTitle: 'Editar decisão', single: true,
    hint: 'Uma frase com o porquê (máx. 280). Ex.: "Usamos Postgres porque o time já domina."',
  },
  note: { label: 'Nota', plural: 'Notas', icon: 'note', newTitle: 'Nova nota', editTitle: 'Editar nota' },
  idea: {
    label: 'Ideia', plural: 'Ideias', icon: 'idea', newTitle: 'Nova ideia', editTitle: 'Editar ideia',
    hint: 'Fica aberta até virar tarefa ou ser descartada.',
  },
  howto: {
    label: 'Como fazer', plural: 'Como fazer', icon: 'book', newTitle: 'Novo “como fazer”', editTitle: 'Editar “como fazer”',
    hint: 'Como resolvemos um problema, o procedimento interno, a quem recorrer.',
  },
  progress: { label: 'Progresso', plural: 'Progresso', icon: 'progress', editTitle: 'Progresso' },
};

/** Tipos que se criam pela aba Memória (progresso nasce da tarefa). */
export const CREATABLE = ['decision', 'note', 'idea', 'howto'];

export const kindOf = (kind) => KINDS[kind] || KINDS.note;

/** Estado de uma ideia, legível. */
export const IDEA_STATUS = { open: 'aberta', converted: 'virou tarefa', discarded: 'descartada' };
