import{describe,expect,it}from'vitest';import{choosePortfolio,runPlan}from'./model';
const days=[{date:'2020-01-01',rainMm:4,flowM3:100},{date:'2020-01-02',rainMm:0,flowM3:10},{date:'2020-01-03',rainMm:0,flowM3:0}];
const ops=[{id:'a',name:'A',type:'tank' as const,capacityM3:100,transferM3:60,costLakh:5,enabled:true},{id:'b',name:'B',type:'recharge' as const,capacityM3:200,transferM3:50,costLakh:20,enabled:true}];
describe('storage planner',()=>{it('respects budget',()=>expect(choosePortfolio(ops,10).reduce((n,x)=>n+x.costLakh,0)).toBeLessThanOrEqual(10));it('preserves water balance',()=>expect(runPlan(days,ops,10,20).balanceError).toBeLessThan(1e-6));it('never worsens unmet demand',()=>{const p=runPlan(days,ops,10,20);expect(p.planned.unmet).toBeLessThanOrEqual(p.baseline.unmet)})});
