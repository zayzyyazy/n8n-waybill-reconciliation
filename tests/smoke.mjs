import assert from 'node:assert/strict';
import {load, readExample, verifyExample} from './harness.mjs';
const run = load('waybill');
const input = readExample('input');
let x = (await run('Evaluate Shipment', input))[0].json;
assert.equal(x.shipment_status, 'WATCH');
x = (await run('Prepare Document Check', x))[0].json;
x = (await run('Evaluate Document Result', [], {'Prepare Document Check': [x]}))[0].json;
x = (await run('Apply Document Decision', x))[0].json;
assert.equal(x.final_exception_code, 'POD_DOCUMENT_MISSING');
x = (await run('Roll Up Order State', x))[0].json;
x = (await run('Build WAYBILL Response', x)).json;
verifyExample('output', x);
assert.equal(x.status, 'EXCEPTION');
const healthy = (await run('Evaluate Shipment', {...input, pod_available:true}))[0].json;
assert.equal(healthy.shipment_status, 'HEALTHY');
const boundary = (await run('Evaluate Shipment', {...input,latest_event_code:'in_transit',days_since_last_event:3}))[0].json;
assert.equal(boundary.shipment_status,'HEALTHY');
const stalled = (await run('Evaluate Shipment', {...input,latest_event_code:'in_transit',days_since_last_event:4}))[0].json;
assert.equal(stalled.exception_code,'STALLED_TRACKING');
const error = (await run('Normalize Carrier Error', {error:{message:'Failed EXAMPLE_TRACKING_NUMBER'}}, {'Extract Shipments':[input]}))[0].json;
assert.equal(error.final_status,'WATCH');
assert.equal(error.final_action,'RETRY_CARRIER');
const unmatched = (await run('Normalize Carrier Error', {message:'Disconnected'}, {'Extract Shipments':[input]}))[0].json;
assert.equal(unmatched.reconciliation_error,'FAILED_TO_RECOVER_SHIPMENT');
assert.equal(unmatched.final_status,undefined); // Known limitation, not a healthy shipment.
const blank = (await run('Evaluate Shipment', {...input,latest_event_code:null,days_since_last_event:null}))[0].json;
assert.equal(blank.shipment_status,'HEALTHY'); // Documents the current empty-response limitation.
const docs = (await run('Evaluate Document Result', [{id:'EXAMPLE_DOC_1',name:'EXAMPLE_TRACKING_NUMBER.pdf'},{id:'EXAMPLE_DOC_2',name:'EXAMPLE_TRACKING_NUMBER-copy.pdf'}], {'Prepare Document Check':[{...input,document_check_required:true,document_search_term:'EXAMPLE_TRACKING_NUMBER'}]}))[0].json;
assert.equal(docs.document_status,'FOUND'); // Multiple matches are not classified as AMBIGUOUS.
assert.equal(docs.document_matches,2);
const mixed = (await run('Roll Up Order State', [error,{...input,final_status:'EXCEPTION',final_exception_code:'POD_DOCUMENT_MISSING',final_action:'CREATE_SUPPORT_TASK'}]))[0].json;
assert.equal(mixed.order_status,'EXCEPTION');
const absent=(await run('Select Requested Order',[], {'WAYBILL — Order Intelligence':{'Order ID':'9001'}}))[0].json;
assert.equal(absent.status,'NOT_FOUND');
console.log('PASS: WAYBILL document, status, carrier error, rollup, and missing-order checks; fixture matches.');
