// Pure scoring helpers. Compute each instrument's OWN total only.
// Never derive a clinical/pharmacological verdict from a total.

export const sum = (arr = []) => arr.reduce((a, b) => a + (Number(b) || 0), 0);

export function computeObservationTotals(obs = {}) {
  if (obs.phq9?.items) obs.phq9.total = sum(obs.phq9.items);
  if (obs.gad7?.items) obs.gad7.total = sum(obs.gad7.items);
  if (obs.pcl5?.items) obs.pcl5.total = sum(obs.pcl5.items);
  return obs;
}

export function computeClassModuleTotals(cm = {}) {
  if (cm.gass?.items) cm.gass.total = sum(cm.gass.items.map((i) => i.score));
  if (cm.sds?.items) cm.sds.total = sum(cm.sds.items);
  if (cm.asrs?.items) cm.asrs.total = sum(cm.asrs.items);
  return cm;
}
