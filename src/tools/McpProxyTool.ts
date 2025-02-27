import * as vscode from 'vscode';
import { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index";
import { CallToolRequest, Tool } from "@modelcontextprotocol/sdk/types";

/**
 * A proxy tool that forwards calls to an MCP tool
 */
export class McpProxyTool implements vscode.LanguageModelChatTool {
    private _client: MCPClient;
    private _tool: Tool;
    public name: string;
    public inputSchema: Tool['inputSchema'];
    public description: string;

    constructor(client: MCPClient, tool: Tool) {
        this._client = client;
        this._tool = tool;
        this.name = tool.name;
        this.inputSchema = tool.inputSchema;
        this.description = tool.description || '';

        this._client.onclose = () => {
            console.log("MCP client closed");
        };

        this._client.onerror = (error) => {
            console.error("MCP client error:", error);
        };
        
        this._client.fallbackNotificationHandler = this._handleNotification.bind(this);
    }

    private _handleNotification(notification: any): Promise<void> {
        console.log("Received notification:", notification);
        return Promise.resolve();
    }

    async prepareInvocation(options: vscode.LanguageModelToolInvocationOptions<any>): Promise<{ confirmationMessage?: string; invocationMessage?: string }> {
        return {
            confirmationMessage: `Allow tool "${this._tool.name}" to run?`,
            invocationMessage: `Running tool "${this._tool.name}"...`
        };
    }

    async invoke(options: vscode.LanguageModelToolInvocationOptions<any>, token: vscode.CancellationToken): Promise<vscode.LanguageModelToolResult> {
        console.log("Invoking tool:", this._tool.name, options.input);
        try{
            const ping = await this._client.ping();
        } catch(e) {
            console.log("Reconnecting with transport:", this._client.transport);
            await this._client.transport?.start();
        }
        try {
            // Define the payload
            const payload: CallToolRequest["params"] = {
                name: this._tool.name,
                arguments: options.input,
                // _meta: {
                // 	toolCallId: options.toolInvocationToken,
                // 	progressToken: options.toolInvocationToken
                // }
            };
            console.log("CallToolRequest Params:", payload);
            const result = await this._client.callTool(payload, );
            console.log("Tool result:", result);
            // Convert MCP result to LanguageModelToolResult
            let content: (vscode.LanguageModelTextPart | vscode.LanguageModelPromptTsxPart)[] = [];
            if (Array.isArray(result.content)) {
                for (const item of result.content) {
                    if (item.type === 'text' && typeof item.text === 'string') {
                        content.push(new vscode.LanguageModelTextPart(item.text));
                    }
                }
            }

            return new vscode.LanguageModelToolResult(content);
        } catch (error) {
            console.error('Tool invocation error:', error);
            throw new Error(`Tool "${this._tool.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}