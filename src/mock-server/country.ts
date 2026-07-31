import type { BrokerId, CountryRule, Form } from '@/api/types';
import { fundCountry, stockProfiles } from './market';
import { adapters } from './server';

export const issuerCountry = (instrumentId: string) => stockProfiles[instrumentId]?.country ?? fundCountry[instrumentId] ?? 'Other';

export const brokerCountry = (brokerId: BrokerId) => adapters.find((a) => a.broker.id === brokerId)!.broker.country;

/**
 * Which country a result is declared under. A CFD is a contract with the broker, so it is always the
 * broker's country; everything else follows the chosen rule.
 */
export function taxCountry(instrumentId: string, form: Form, brokerId: BrokerId, rule: CountryRule) {
  if (form === 'cfd' || rule === 'broker') return brokerCountry(brokerId);
  return issuerCountry(instrumentId);
}
