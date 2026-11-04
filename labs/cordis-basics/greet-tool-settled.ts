/**
 * Book lab code: the Cordis tutorial chapter 7 `greet` tool, changed so its demo call
 * cannot race the tool executor. Only the marked lines differ from the tutorial.
 */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/cordis-plugin-loader'
import { brandString } from '@deepseek-ai/dsh-brand'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { ToolCallId } from '@deepseek-ai/dsh-llm'

export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet the named person in Gujarati.',                          // changed
    parameters: {
      name: { type: 'string', required: true, description: 'Who to greet' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return `નમસ્તે, ${args.name}!`                                              // changed
    },
  }))

  void (async () => {
    // changed: wait until every config row has settled, so an executor row listed
    // later in cordis.yml has activated before the demo call selects it.
    await ctx.get('loader')?.await()
    const result = await ctx.tools.execute({
      calls: [{
        type: 'tool-call', id: brandString<ToolCallId>('demo-1'),
        name: 'greet', arguments: JSON.stringify({ name: 'Cordis' }),
      }],
      signal: new AbortController().signal,
    })
    console.log('tool replied:', JSON.stringify(result.results[0]?.result.content))
  })()
}
