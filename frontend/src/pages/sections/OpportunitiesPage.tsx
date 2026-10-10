import { useParams } from "react-router-dom";

import { useOpportunities } from "../../api/hooks";
import { OpportunityCards } from "../../components/dashboard/OpportunityCards";
import { OpportunityScatter } from "../../components/dashboard/OpportunityScatter";
import { Panel } from "../../components/Panel";
import { SectionPage } from "../../components/SectionPage";
import { parseMarketId } from "../../lib/ids";
import { EmptyState, Loading, QueryBody } from "../../components/states";

export default function OpportunitiesPage() {
  const id = parseMarketId(useParams().id);
  const opportunities = useOpportunities(id);
  const empty = (
    <EmptyState
      title="No opportunities scored yet"
      hint="Each probe gets a 0-100 score with reasons, confidence and caveats once a scan has shelf and Trends data."
    />
  );
  return (
    <SectionPage
      id={id}
      label="OPPORTUNITIES"
      title="Where demand outruns the shelf"
      intro="Scores combine demand, shelf room, incumbent strength and price headroom. Confidence is shown separately and never changes the score."
      scan={opportunities.data?.scan}
    >
      <div className="dash-grid">
        <Panel label="DEMAND × SUPPLY" title="Probe matrix" className="span-7">
          <QueryBody
            query={opportunities}
            loading={<Loading height={340} />}
            errorTitle="Couldn't load opportunities"
            isEmpty={(v) => v.items.length === 0}
            empty={empty}
          >
            {(value) => <OpportunityScatter opportunities={value.items} />}
          </QueryBody>
        </Panel>
        <Panel label="RANKED" title="Ranked probes" className="span-5">
          <QueryBody query={opportunities} loading={<Loading rows={8} />} isEmpty={(v) => v.items.length === 0} empty={empty}>
            {(value) => <OpportunityCards opportunities={value.items} />}
          </QueryBody>
        </Panel>
      </div>
    </SectionPage>
  );
}
