import type { Level } from '@sa/engine';
import type { LevelExamples } from './common';
import * as l1 from './l1-clinic';
import * as l2 from './l2-fashion';
import * as l3 from './l3-logistics';
import * as l4 from './l4-retail-erp';
import * as l5 from './l5-insurance';
import * as l6 from './l6-saas-tenancy';
import * as l7 from './l7-fintech-pci';
import * as l8 from './l8-rfp-boss';

const modules: { level: Level; examples: LevelExamples }[] = [l1, l2, l3, l4, l5, l6, l7, l8];

export const levels: Level[] = modules.map((m) => m.level);
export const levelExamples: Record<string, LevelExamples> = Object.fromEntries(modules.map((m) => [m.level.id, m.examples]));
export type { LevelExamples } from './common';
