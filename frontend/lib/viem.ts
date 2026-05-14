import { createPublicClient, http } from 'viem';
import { zg } from './chain';
export const pub = createPublicClient({ chain: zg, transport: http() });
