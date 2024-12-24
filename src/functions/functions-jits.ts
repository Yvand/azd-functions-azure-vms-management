import { JitNetworkAccessPolicy, JitNetworkAccessPolicyVirtualMachine } from "@azure/arm-security";
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { jits_createOrUpdate, jits_delete, jits_get, jits_initiate, jits_list } from "../security/jitPolicies.js";
import { logError } from "../utils/loggingHandler.js";
import { CommonConfig, safeWait } from "../utils/common.js";
import { virtualMachines_get } from "../compute/virtualMachines.js";

/**
 * 
 * Permission required: Microsoft.Compute/virtualMachines/read
 * @param request 
 * @param context 
 * @returns 
 */
export async function listJits(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        if (!g) { return { status: 400, body: `Required parameters are missing.` }; }

        const jits: JitNetworkAccessPolicy[] = await jits_list(g);
        return { status: 200, jsonBody: jits };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

export async function getJit(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        const jitPolicyName = request.query.get('policyName') || "default";
        if (!g) { return { status: 400, body: `Required parameters are missing.` }; }

        const jits = await jits_get(g, jitPolicyName);
        return { status: 200, jsonBody: jits };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

export async function initiateJit(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        const jitPolicyName = request.query.get('policyName') || "default";
        const vmName = request.query.get('vm');
        const durationInHours = Number(request.query.get('duration')) || 10;
        if (!g || !vmName) { return { status: 400, body: `Required parameters are missing.` }; }

        const jits = await jits_initiate(g, jitPolicyName, vmName, durationInHours);
        return { status: 200, jsonBody: jits };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

export async function createOrUpdateJit(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        const jitPolicyName = request.query.get('policyName') || "default";
        const vmName = request.query.get('vm');
        const maxDurationInHours = Number(request.query.get('maxDuration')) || 10;
        if (!g || !vmName) { return { status: 400, body: `Required parameters are missing.` }; }

        const [virtualMachine, error] = await safeWait(virtualMachines_get(g, vmName));
        if (error || !virtualMachine.id) { return { status: 400, body: `Virtual machine '${vmName}' was not found in '${g}'.` }; }

        const virtualMachinePolicy: JitNetworkAccessPolicyVirtualMachine = {
            id: virtualMachine.id,
            ports: [
                {
                    number: 3389,
                    protocol: "TCP",
                    allowedSourceAddressPrefixes: CommonConfig.AllowedIpAddressPrefixes,
                    maxRequestAccessDuration: `PT${maxDurationInHours}H`
                }
            ]
        }
        const jitPolicy = await jits_createOrUpdate(g, jitPolicyName, virtualMachine.location, virtualMachinePolicy);
        return { status: 200, jsonBody: jitPolicy };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

export async function deleteJit(request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> {
    try {
        const g = request.query.get('g');
        const jitPolicyName = request.query.get('policyName') || "default";
        if (!g || !jitPolicyName) { return { status: 400, body: `Required parameters are missing.` }; }

        const jitPolicyDeleted = await jits_delete(g, jitPolicyName);
        if (jitPolicyDeleted === true) {
            return { status: 204 }; 
        } else { 
            return { status: 400, body: `JIT policy '${jitPolicyName}' was not deleted in '${g}'.` }; 
        }
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

app.http('jits-list', { methods: ['GET'], authLevel: 'function', handler: listJits, route: 'jits/list' });
app.http('jits-get', { methods: ['GET'], authLevel: 'function', handler: getJit, route: 'jits/get' });
app.http('jits-initiate', { methods: ['POST'], authLevel: 'function', handler: initiateJit, route: 'jits/initiate' });
app.http('jits-createOrUpdate', { methods: ['POST'], authLevel: 'function', handler: createOrUpdateJit, route: 'jits/createOrUpdate' });
app.http('jits-delete', { methods: ['POST'], authLevel: 'function', handler: deleteJit, route: 'jits/delete' });
