export class VocabularyManager {
  static getInstance(): VocabularyManager { return new VocabularyManager(); }
  getVocabulary(): any[] { return []; }
  addTerm(term: any): void {}
}
