import React from 'react';
import {act,create,type ReactTestRenderer} from 'react-test-renderer';
import Tabs from '@/app/(tabs)/_layout';
import mockHome from '@/app/(tabs)/index';
import mockHistoryScreen from '@/components/drops/HistoryScreen';
import {ProfileEditor} from '@/components/drops/ProfileEditor';
import type {DropsSnapshot,DropsEntry,EntryInput,MutationReceipt} from '@/lib/drops/types';

jest.mock('tamagui',()=>{const React=require('react');const component=(name:string)=>({children,...props}:any)=>React.createElement(name,props,children);return Object.fromEntries(['Button','Text','XStack','YStack','ScrollView','Input'].map(n=>[n,component(`Test${n}`)]));});
jest.mock('lucide-react-native',()=>Object.fromEntries(['Settings','X','Plus','Check','Droplets','Droplet','History','Pill','Coffee','SlidersHorizontal','BarChart3'].map(n=>[n,()=>null])));
jest.mock('@react-navigation/native',()=>({useIsFocused:()=>true}));
jest.mock('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:24,bottom:10})}));
jest.mock('expo-crypto',()=>({randomUUID:()=>`operation-${++mockSequence}`}));
jest.mock('@/components/FeedbackProvider',()=>({useFeedback:()=>mockFeedback}));
jest.mock('@/features/drops/DropsProvider',()=>({DropsProvider:({children}:any)=>children,useDrops:()=>{const React=require('react');return React.useSyncExternalStore((listener:()=>void)=>{mockListeners.add(listener);return ()=>mockListeners.delete(listener);},()=>mockController);}}));
jest.mock('expo-router',()=>({usePathname:()=>mockPath,useRouter:()=>({navigate:mockNavigate,push:mockNavigate}),Slot:()=>{const React=require('react');return mockPath.includes('supps')?React.createElement('TestText',{},'Supplement destination'):mockPath.includes('history')?React.createElement(mockHistoryScreen):React.createElement(mockHome);}}));
jest.mock('@/components/pitwall/PitwallOverlays',()=>{const React=require('react');return ({PitwallSheet:({children,open,title}:any)=>open?React.createElement('TestSheet',{title},children):null});});
jest.mock('@/components/drops/PerformanceSheet',()=>({PerformanceSheet:({open}:any)=>require('react').createElement('TestPerformanceSheet',{open})}));
jest.mock('@/components/pitwall/PitwallDashboard',()=>{const React=require('react');return {PitwallDashboard:({waterAmount,waterUnit,waterGoal,waterLimit}:any)=>React.createElement('TestDashboard',{waterGoal,waterLimit},React.createElement('TestText',{'testID':'water-total'},`${waterAmount} ${waterUnit}`))};});
jest.mock('@/components/pitwall/WaterScene',()=>({WaterScene:()=>null}));

const mockNow=new Date('2026-10-04T12:00:00Z');
const mockListeners=new Set<()=>void>();
const mockFeedback={prime:jest.fn(),confirm:jest.fn(),reducedMotion:false,active:true};
const mockAdd=jest.fn(),mockUndo=jest.fn();
let mockSequence=0,mockPath='/',mockController:any,renderer:ReactTestRenderer;
const mockNavigate=jest.fn((path:string)=>{mockPath=path;publish({});});
function publish(changes:Record<string,unknown>){mockController={...mockController,...changes};mockListeners.forEach(listener=>listener());}
function snapshot():DropsSnapshot{return {trackers:[
 {id:'builtin:water',name:'Water',category:'water',metricType:'water',unit:'oz',savedDose:null,archived:false,plans:[{id:'water-plan',effectiveFrom:'2026-01-01',mode:'as-needed',days:[],doses:[],target:150,limit:null,unit:'oz'}]},
 {id:'builtin:creatine',name:'Creatine',category:'supplement',metricType:'creatine',unit:'g',savedDose:5,archived:false,plans:[]},
 {id:'custom:blend',name:'Electrolyte blend',category:'supplement',metricType:'other',unit:'scoops',savedDose:1.25,archived:false,plans:[]},
 {id:'medication:tablet',name:'Prescription tablet',category:'medication',metricType:'other',unit:'tablets',savedDose:null,archived:false,plans:[]}
],entries:[],primaryTrackerId:'builtin:creatine',preferences:{timezone:'UTC',waterPresets:[{id:'small',amount:8,unit:'oz'},{id:'large',amount:16,unit:'oz'}],prominentPresetIds:['small','large'],remindersEnabled:false,priorUse:{creatine:'unknown',caffeine:'unknown'},caffeineHalfLifeHours:5,bedtime:'22:00'}};}
function receipt(input:EntryInput,id:string):MutationReceipt{const tracker=mockController.snapshot.trackers.find((t:any)=>t.id===input.trackerId);const entry:DropsEntry={...input,id,storageKind:input.trackerId.startsWith('builtin:')?'intake':'tracker',name:tracker.name,consumedAtUtc:input.consumedAt,legacyLocal:null,day:'2026-10-04',version:1};return {operationId:id,kind:'add',before:null,after:entry};}
function persist(r:MutationReceipt){publish({snapshot:{...mockController.snapshot,entries:[...mockController.snapshot.entries,r.after]}});return r;}
function deferred<T>(){let resolve!:(v:T)=>void;const promise=new Promise<T>(r=>{resolve=r;});return {promise,resolve};}
const texts=()=>renderer.root.findAllByType('TestText' as never).map(n=>n.children.join(''));
const button=(label:string)=>renderer.root.findAllByType('TestButton' as never).find(n=>n.props['aria-label']===label)!;
async function press(label:string){await act(async()=>{button(label).props.onPress();for(let i=0;i<8;i++)await Promise.resolve();});}
async function mount(component:React.ReactElement=<Tabs/>){await act(async()=>{renderer=create(component);});}
beforeEach(()=>{jest.clearAllMocks();mockListeners.clear();mockSequence=0;mockPath='/';mockController={snapshot:snapshot(),now:mockNow,status:'ready',error:null,addRequest:null,openAdd:(prefill={})=>publish({addRequest:prefill}),closeAdd:()=>publish({addRequest:null}),add:mockAdd,undo:mockUndo};mockAdd.mockImplementation(async(input,id)=>persist(receipt(input,id)));mockUndo.mockImplementation(async(r:MutationReceipt,id:string)=>{publish({snapshot:{...mockController.snapshot,entries:mockController.snapshot.entries.filter((e:DropsEntry)=>e.id!==r.after?.id||e.storageKind!==r.after?.storageKind)}});return {operationId:id,kind:'delete',before:r.after,after:null};});});
afterEach(async()=>{if(renderer)await act(async()=>renderer.unmount());});

it('waits for repository water persistence, totals8plus16, and Undo passes the exact receipt',async()=>{
 const save=deferred<MutationReceipt>();mockAdd.mockImplementationOnce(async()=>persist(await save.promise));await mount();expect(button('Add 8 oz water')).toBeUndefined();await press('Log intake');await press('Add 8 oz water');expect(mockAdd).toHaveBeenCalledTimes(1);expect(mockFeedback.confirm).not.toHaveBeenCalled();expect(texts().some(t=>t.includes('Added Water'))).toBe(false);
 const first=receipt({trackerId:'builtin:water',amount:8,unit:'oz',consumedAt:mockNow.toISOString(),note:''},'saved-water1');await act(async()=>{save.resolve(first);await save.promise;});expect(mockFeedback.confirm).toHaveBeenCalledWith('water');await press('Add 16 oz water');expect(renderer.root.findByProps({testID:'water-total'}).children.join('')).toBe('24 oz');const saved=mockController.snapshot.entries[1];await press('Undo exact intake');expect(mockUndo).toHaveBeenCalledWith(expect.objectContaining({after:saved}),expect.any(String));expect(mockController.snapshot.entries.map((e:DropsEntry)=>e.id)).toEqual(['saved-water1']);expect(renderer.root.findByProps({testID:'water-total'}).children.join('')).toBe('8 oz');expect(mockFeedback.confirm).toHaveBeenLastCalledWith('undo');
});
it('persistence errors retain the add actions and emit no confirmed receipt or feedback',async()=>{
 mockAdd.mockRejectedValueOnce(new Error('offline write failed'));await mount();await press('Log intake');await press('Add 8 oz water');expect(texts()).toContain('offline write failed');expect(texts().some(t=>t.includes('Added Water'))).toBe(false);expect(mockFeedback.confirm).not.toHaveBeenCalled();expect(mockController.snapshot.entries).toHaveLength(0);
});
it('pending supplement taps cannot duplicate one intent; later deliberate taps stay distinct',async()=>{
 const save=deferred<MutationReceipt>();mockAdd.mockImplementationOnce(async()=>persist(await save.promise));await mount();await press('Log intake');await press('Log 5 g Creatine');await press('Log 5 g Creatine');expect(mockAdd).toHaveBeenCalledTimes(1);expect(mockFeedback.confirm).not.toHaveBeenCalledWith('supplement');const first=receipt({trackerId:'builtin:creatine',amount:5,unit:'g',consumedAt:mockNow.toISOString(),note:''},'saved-dose1');await act(async()=>{save.resolve(first);await save.promise;});await press('Log 5 g Creatine');expect(mockAdd).toHaveBeenCalledTimes(2);expect(mockController.snapshot.entries).toHaveLength(2);expect(mockAdd.mock.calls[0][1]).not.toBe(mockAdd.mock.calls[1][1]);await press('Undo exact intake');expect(mockController.snapshot.entries.map((e:DropsEntry)=>e.id)).toEqual(['saved-dose1']);
});
it('shared navigation selects destinations and + preserves the selected route',async()=>{
 await mount();expect(renderer.root.findByType('TestDashboard' as never)).toBeTruthy();await press('Supps');expect(texts()).toContain('Supplement destination');const route=mockPath;await press('Log intake');expect(mockPath).toBe(route);await press('Done');await press('Home');expect(renderer.root.findByType('TestDashboard' as never)).toBeTruthy();
});
it('unified History retains four distinct IDs with equal timestamps and custom units',async()=>{
 for(const [trackerId,amount,unit,id] of [['builtin:water',12,'oz','water-history'],['builtin:creatine',5,'g','creatine-history'],['custom:blend',1.25,'scoops','blend-history'],['medication:tablet',1,'tablets','medication-history']] as const){persist(receipt({trackerId,amount,unit,consumedAt:mockNow.toISOString(),note:''},id));}
 await mount(React.createElement(mockHistoryScreen));const rows=renderer.root.findAllByType('TestButton' as never).filter(n=>String(n.props['aria-label']).startsWith('Edit '));expect(rows).toHaveLength(4);expect(new Set(mockController.snapshot.entries.map((e:DropsEntry)=>e.id)).size).toBe(4);expect(texts()).toEqual(expect.arrayContaining(['Water','Creatine','Electrolyte blend','Prescription tablet','scoops','tablets']));
});

it('Home converts a retained mL plan target and limit to the current oz display unit',async()=>{
 const water=mockController.snapshot.trackers[0];water.plans[0]={...water.plans[0],unit:'mL',target:2365.882365,limit:2957.35295625};
 await mount();const dashboard=renderer.root.findByType('TestDashboard' as never);
 expect(dashboard.props.waterGoal).toBeCloseTo(80,8);expect(dashboard.props.waterLimit).toBeCloseTo(100,8);
});

it('the accessible Performance trigger opens its breakdown sheet',async()=>{
 await mount();expect(renderer.root.findByType('TestPerformanceSheet' as never).props.open).toBe(false);
 const trigger=renderer.root.findAll(n=>n.props.accessibilityLabel==='Open Performance breakdown'&&typeof n.props.onPress==='function')[0];
 expect(trigger.props.accessibilityRole).toBe('button');await act(async()=>trigger.props.onPress());
 expect(renderer.root.findByType('TestPerformanceSheet' as never).props.open).toBe(true);
});

it('editing a profile converts source plan quantities before saving in its display unit',async()=>{
 const tracker={...mockController.snapshot.trackers[2],unit:'g',plans:[{id:'source-plan',effectiveFrom:'2026-01-01',mode:'as-needed',days:[],doses:[],unit:'mg',target:5000,limit:10000}]};
 const save=jest.fn().mockResolvedValue(undefined);mockController.saveProfile=save;
 await mount(<ProfileEditor tracker={tracker} onClose={()=>{}}/>);
 const inputs=renderer.root.findAllByType('TestInput' as never);
 expect(inputs.find(n=>n.props['aria-label']==='Quantity target (optional)')?.props.value).toBe('5');
 expect(inputs.find(n=>n.props['aria-label']==='Quantity limit (optional)')?.props.value).toBe('10');
 await press('Save tracker');expect(save).toHaveBeenCalledWith(expect.objectContaining({unit:'g',plan:expect.objectContaining({unit:'g',target:5,limit:10})}));
});


