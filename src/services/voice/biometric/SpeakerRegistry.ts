export class SpeakerRegistry {
  static getInstance(): SpeakerRegistry { return new SpeakerRegistry(); }
  enroll(id: string, profile: any): Promise<void> { return Promise.resolve(); }
}
