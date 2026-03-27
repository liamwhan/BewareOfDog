import type { HttpAuthConfig, HttpAuthType, RequestAuth } from '../../shared/types'
import { InputWithVariableTooltips, type VariableTooltipContext } from './VariableFieldWithTooltips'

type Props =
  | {
      mode: 'collection'
      value: HttpAuthConfig
      onChange: (next: HttpAuthConfig) => void
      variableContext?: VariableTooltipContext
    }
  | {
      mode: 'request'
      value: RequestAuth
      onChange: (next: RequestAuth) => void
      variableContext?: VariableTooltipContext
    }

const AUTH_TYPES: { value: HttpAuthType; label: string }[] = [
  { value: 'none', label: 'No auth' },
  { value: 'bearer', label: 'Bearer token' },
  { value: 'basic', label: 'Basic auth' }
]

export function AuthEditor(props: Props) {
  const inherit = props.mode === 'request' ? props.value.inheritFromCollection : false
  const type = props.mode === 'request' && inherit ? 'none' : props.value.type
  const bearerToken = props.value.bearerToken
  const username = props.value.username
  const password = props.value.password

  const patch = (partial: Partial<HttpAuthConfig>) => {
    if (props.mode === 'collection') {
      props.onChange({ ...props.value, ...partial })
    } else {
      props.onChange({ ...props.value, ...partial })
    }
  }

  const setInherit = (next: boolean) => {
    if (props.mode !== 'request') return
    props.onChange({ ...props.value, inheritFromCollection: next })
  }

  return (
    <div className="space-y-4 text-sm">
      {props.mode === 'request' && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={inherit}
            onChange={(e) => setInherit(e.target.checked)}
            className="rounded border-slate-600"
          />
          <span>Inherit from collection</span>
        </label>
      )}

      {!inherit && (
        <>
          <div>
            <label className="block text-slate-400 mb-1">Type</label>
            <select
              value={type}
              onChange={(e) => patch({ type: e.target.value as HttpAuthType })}
              disabled={props.mode === 'request' && inherit}
              className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded text-slate-100"
            >
              {AUTH_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {type === 'bearer' && (
            <div>
              <label className="block text-slate-400 mb-1">Token</label>
              {props.variableContext ? (
                <InputWithVariableTooltips
                  value={bearerToken}
                  onChange={(v) => patch({ bearerToken: v })}
                  variableContext={props.variableContext}
                  placeholder="{{accessToken}} or raw token"
                  className="w-full font-mono text-xs"
                  inputClassName="px-2 py-1.5"
                  autoComplete="off"
                />
              ) : (
                <input
                  type="text"
                  value={bearerToken}
                  onChange={(e) => patch({ bearerToken: e.target.value })}
                  placeholder="{{accessToken}} or raw token"
                  autoComplete="off"
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded font-mono text-xs text-slate-100 placeholder-slate-500"
                />
              )}
              <p className="text-slate-500 text-xs mt-1">
                Sent as <code className="bg-slate-800 px-1 rounded">Authorization: Bearer …</code>
              </p>
            </div>
          )}

          {type === 'basic' && (
            <div className="space-y-2">
              <div>
                <label className="block text-slate-400 mb-1">Username</label>
                {props.variableContext ? (
                  <InputWithVariableTooltips
                    value={username}
                    onChange={(v) => patch({ username: v })}
                    variableContext={props.variableContext}
                    placeholder="{{apiUser}}"
                    className="w-full font-mono text-xs"
                    inputClassName="px-2 py-1.5"
                    autoComplete="off"
                  />
                ) : (
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => patch({ username: e.target.value })}
                    placeholder="{{apiUser}}"
                    autoComplete="off"
                    className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded font-mono text-xs"
                  />
                )}
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => patch({ password: e.target.value })}
                  placeholder="{{apiSecret}}"
                  autoComplete="off"
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-600 rounded font-mono text-xs"
                />
              </div>
              <p className="text-slate-500 text-xs">
                Encoded as Base64 for <code className="bg-slate-800 px-1 rounded">Authorization: Basic …</code>
              </p>
            </div>
          )}
        </>
      )}

      {props.mode === 'request' && inherit && (
        <p className="text-slate-500 text-xs">
          This request uses the collection Authorization settings. Edit them by clicking the collection name in the
          sidebar.
        </p>
      )}
    </div>
  )
}
