import { Outlet, useParams } from "react-router-dom";

/** Keyed by market so per-market page state (filters, open drawers, replay position) resets on switch. */
export default function MarketLayout() {
  const params = useParams();
  return (
    <div key={params.id}>
      <Outlet />
    </div>
  );
}
