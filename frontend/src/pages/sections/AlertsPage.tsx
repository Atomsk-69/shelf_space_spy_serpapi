import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import { useAlertRules, useAlerts, useMarkAlertsRead, useUpdateAlertRule } from "../../api/hooks";
import { Panel } from "../../components/Panel";
import { SectionPage } from "../../components/SectionPage";
import { ConfidenceBadge, SeverityBadge } from "../../components/ui/Badge";
import { EVENT_TYPES } from "../../lib/events";
import { EmptyState, Loading, QueryBody } from "../../components/states";
import { formatRelativeTime, humanize } from "../../lib/format";
import { parseMarketId } from "../../lib/ids";
import type { AlertRule } from "../../types";

/** Alerts are filtered in the browser, so the newest slice (the API maximum) is loaded. */
const FETCH_LIMIT = 200;
const LEVELS = ["low", "medium", "high"];
const SCOPES: Record<string, string> = { any: "any brand", mine: "your brand only", competitors: "competitors only" };

function RuleRow({ rule, marketId }: { rule: AlertRule; marketId: number }) {
  const update = useUpdateAlertRule(marketId);
  return (
    <li className="rule-row">
      <label className="check-inline">
        <input
          type="checkbox"
          checked={rule.enabled}
          disabled={update.isPending}
          onChange={(event) => update.mutate({ ruleId: rule.id, body: { enabled: event.target.checked } })}
        />
        <strong>{rule.name}</strong>
      </label>
      <p className="field-hint">
        {rule.event_types.map((type) => humanize(type)).join(", ")} · {SCOPES[rule.scope] ?? rule.scope}
      </p>
      <div className="rule-controls">
        <label>
          Minimum confidence{" "}
          <select
            value={rule.min_confidence}
            disabled={update.isPending}
            onChange={(event) => update.mutate({ ruleId: rule.id, body: { min_confidence: event.target.value } })}
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {humanize(level)}
              </option>
            ))}
          </select>
        </label>
        <label>
          Minimum severity{" "}
          <select
            value={rule.min_severity}
            disabled={update.isPending}
            onChange={(event) => update.mutate({ ruleId: rule.id, body: { min_severity: event.target.value } })}
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {humanize(level)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {update.isError && (
        <p className="field-error" role="alert">
          Couldn't save this rule.
        </p>
      )}
    </li>
  );
}

export default function AlertsPage() {
  const id = parseMarketId(useParams().id);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [severity, setSeverity] = useState("");
  const [eventType, setEventType] = useState("");
  const alerts = useAlerts(id, unreadOnly, FETCH_LIMIT, 0);
  const rules = useAlertRules(id);
  const markRead = useMarkAlertsRead(id);
  const unread = alerts.data?.unread ?? 0;
  const visible = useMemo(
    () =>
      (alerts.data?.items ?? []).filter(
        (alert) => (!severity || alert.severity === severity) && (!eventType || alert.event_type === eventType),
      ),
    [alerts.data, severity, eventType],
  );

  return (
    <SectionPage
      id={id}
      label="ALERTS"
      title="What needs your attention"
      intro="Alerts come from detected changes after each live scan. A rule only fires for events at or above its confidence and severity."
    >
      <div className="dash-grid">
        <Panel
          label="INBOX"
          title={unread > 0 ? `${unread} unread` : "All caught up"}
          className="span-7"
          actions={
            <>
              <label className="check-inline">
                <input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />
                Unread only
              </label>
              <button
                type="button"
                className="button-secondary button-small"
                disabled={unread === 0 || markRead.isPending}
                onClick={() => markRead.mutate(undefined)}
              >
                Mark all read
              </button>
            </>
          }
        >
          <div className="filter-bar">
            <label>
              Severity
              <select value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="">Any</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <label>
              Type
              <select value={eventType} onChange={(event) => setEventType(event.target.value)}>
                <option value="">Any</option>
                {Object.entries(EVENT_TYPES).map(([type, meta]) => (
                  <option key={type} value={type}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <QueryBody
            query={alerts}
            loading={<Loading rows={5} />}
            errorTitle="Couldn't load alerts"
            isEmpty={() => visible.length === 0}
            empty={
              <EmptyState
                title={severity || eventType || unreadOnly ? "No alerts match these filters" : "No alerts"}
                hint={
                  severity || eventType || unreadOnly
                    ? "Try clearing a filter."
                    : "They appear after a live scan finds a change that matches an enabled rule."
                }
              />
            }
          >
            {(value) => (
              <>
                <ul className="alert-list">
                  {visible.map((alert) => (
                    <li key={alert.id} className={alert.read_at ? "alert-item" : "alert-item is-unread"}>
                      <div className="badge-row">
                        {!alert.read_at && (
                          <span className="unread-dot" role="img" aria-label="Unread">
                            ●
                          </span>
                        )}
                        <strong className="alert-type">{EVENT_TYPES[alert.event_type]?.label ?? humanize(alert.event_type)}</strong>
                        <SeverityBadge level={alert.severity} />
                        <ConfidenceBadge level={alert.confidence} />
                      </div>
                      <p className="alert-title">{alert.title}</p>
                      <p className="field-hint">
                        {alert.rule_name} · {formatRelativeTime(alert.created_at)}
                      </p>
                      {alert.detail && alert.confidence !== "high" && <p className="event-caveat">{alert.detail}</p>}
                      {!alert.read_at && (
                        <button type="button" className="text-button" onClick={() => markRead.mutate([alert.id])}>
                          Mark read
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="data-note">
                  Showing {visible.length} of {value.total} alert{value.total === 1 ? "" : "s"}.
                </p>
              </>
            )}
          </QueryBody>
        </Panel>

        <Panel label="RULES" title="When to alert" className="span-5">
          <QueryBody query={rules} loading={<Loading rows={4} />} errorTitle="Couldn't load alert rules">
            {(value) => (
              <ul className="rule-list">
                {value.map((rule) => (
                  <RuleRow key={rule.id} rule={rule} marketId={id} />
                ))}
              </ul>
            )}
          </QueryBody>
        </Panel>
      </div>
    </SectionPage>
  );
}
