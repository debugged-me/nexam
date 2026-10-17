import { describe, expect, it } from 'vitest';
import { addMaterialPassages, filterAssessmentMaterials, groupAssessmentSources } from './assessmentSources.js';

describe('assessment source selection', () => {
  const materials = [
    { id: 's', title: 'PATHFit syllabus', is_syllabus: 1 },
    { id: 'a', title: 'Badminton module', is_syllabus: 0 },
    { id: 'b', title: 'Volleyball slides', is_syllabus: 0 },
  ];

  it('searches large material lists by title and classification', () => {
    expect(filterAssessmentMaterials(materials, 'badminton').map((m) => m.id)).toEqual(['a']);
    expect(filterAssessmentMaterials(materials, 'lesson').map((m) => m.id)).toEqual(['a', 'b']);
    expect(filterAssessmentMaterials(materials, 'syllabus').map((m) => m.id)).toEqual(['s']);
  });

  it('adds every passage from multiple materials without replacing prior selections', () => {
    const first = addMaterialPassages(new Map(), [{ id: 'a1', text: 'A one' }, { id: 'a2', text: 'A two' }], materials[1]);
    const second = addMaterialPassages(first, [{ id: 'b1', text: 'B one' }], materials[2]);
    expect([...second.keys()]).toEqual(['a1', 'a2', 'b1']);
    expect(groupAssessmentSources(second).map((group) => [group.materialId, group.chunkIds.length])).toEqual([['a', 2], ['b', 1]]);
  });

  it('fails closed when selecting a material would exceed the passage limit', () => {
    const existing = new Map([['a1', { text: 'A', materialId: 'a', title: 'A' }]]);
    expect(addMaterialPassages(existing, [{ id: 'b1', text: 'B' }], materials[2], 1)).toBeNull();
    expect(existing.size).toBe(1);
  });
});
