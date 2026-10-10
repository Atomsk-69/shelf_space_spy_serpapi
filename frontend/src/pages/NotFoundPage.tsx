import { Link } from "react-router-dom";

import { EmptyState } from "../components/states";

export default function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      hint="That address doesn't match anything in Shelf Space Spy."
      action={
        <Link to="/" className="button-link">
          Back to the home page
        </Link>
      }
    />
  );
}
