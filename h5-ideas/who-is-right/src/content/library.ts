import raw from './sayings.json' with { type: 'json' };
import type { Library } from '../types';

export const library = raw as unknown as Library;
