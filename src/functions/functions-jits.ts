import { JitNetworkAccessPolicy } from "@azure/arm-security";
import { app, HttpRequest, HttpResponseInit, InvocationContext } from "@azure/functions";
import { jits_get, jits_initiate, jits_list } from "../security/jit.js";
import { logError } from "../utils/loggingHandler.js";

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
        const jitPolicyName = request.query.get('jitPolicy') || "default";
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
        const vmName = request.query.get('vm');
        const jitPolicyName = request.query.get('jitPolicy') || "default";
        const durationInHours = Number(request.query.get('duration')) || 10;
        if (!g || !vmName) { return { status: 400, body: `Required parameters are missing.` }; }

        const jits = await jits_initiate(g, vmName, jitPolicyName, durationInHours);
        return { status: 200, jsonBody: jits };
    }
    catch (error: unknown) {
        const errorDetails = logError(context, error, context.functionName);
        return { status: errorDetails.httpStatus, jsonBody: errorDetails };
    }
};

app.http('jits-list', { methods: ['GET'], authLevel: 'function', handler: listJits, route: 'jits/list' });
app.http('jits-get', { methods: ['GET'], authLevel: 'function', handler: getJit, route: 'jits/get' });
app.http('jits-initiate', { methods: ['POST'], authLevel: 'function', handler: initiateJit, route: 'jits/initiate' });
