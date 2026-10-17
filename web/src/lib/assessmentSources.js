export function filterAssessmentMaterials(materials = [], query = '') {
  const needle = String(query).trim().toLowerCase();
  if (!needle) return materials;
  return materials.filter((material) =>
    `${material.title || ''} ${Number(material.is_syllabus) ? 'syllabus' : 'lesson'}`.toLowerCase().includes(needle));
}

export function groupAssessmentSources(sources = new Map()) {
  const groups = new Map();
  for (const [chunkId, source] of sources) {
    const key = source.materialId || `unknown:${chunkId}`;
    if (!groups.has(key)) groups.set(key, {
      materialId: source.materialId || null,
      title: source.title || 'Selected source',
      chunkIds: [],
    });
    groups.get(key).chunkIds.push(chunkId);
  }
  return [...groups.values()];
}

export function addMaterialPassages(sources, chunks, material, limit = 100) {
  const additions = chunks.filter((chunk) => !sources.has(chunk.id));
  if (sources.size + additions.length > limit) return null;
  const next = new Map(sources);
  additions.forEach((chunk) => next.set(chunk.id, {
    text: chunk.text,
    materialId: material?.id || null,
    title: material?.title || null,
  }));
  return next;
}
