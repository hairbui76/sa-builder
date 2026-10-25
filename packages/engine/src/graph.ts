import type { ComponentDef } from './types';

/**
 * Which component may be wired to which. The UI uses this to refuse a wire;
 * the engine uses it to ignore wires that could never carry traffic.
 */
export function canConnect(from: ComponentDef, to: ComponentDef): boolean {
  if (from.behavior === 'attachment' || to.behavior === 'attachment') return false;
  if (to.behavior === 'entry') return false;
  // On-prem systems are only reachable through a hybrid link.
  if (to.props?.onPrem && from.behavior !== 'link' && !from.props?.onPrem) return false;

  const ingressTarget =
    to.behavior === 'router' ||
    to.behavior === 'edge_cache' ||
    to.behavior === 'compute' ||
    (to.behavior === 'provider' && (to.ingress?.length ?? 0) > 0);
  const callTarget =
    to.behavior === 'provider' || to.behavior === 'cache' || to.behavior === 'queue' || to.behavior === 'link';

  switch (from.behavior) {
    case 'entry':
    case 'router':
    case 'edge_cache':
      return ingressTarget;
    case 'compute':
    case 'worker':
      return callTarget;
    case 'cache':
      return to.behavior === 'provider' || to.behavior === 'link';
    case 'link':
      return to.behavior === 'provider' || to.behavior === 'cache' || to.behavior === 'queue';
    case 'queue':
      return to.behavior === 'worker';
    case 'provider':
      return false;
    default:
      return false;
  }
}
