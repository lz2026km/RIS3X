import React from "react";

export interface CriticalValueV2 {
  id?: string;
  triggeredAt: string;
  category: string;
  notifyStatus: string;
  recipient: string;
  ackedAt?: string;
}

export const CriticalEscalationV2: React.FC<any> = () => null;
