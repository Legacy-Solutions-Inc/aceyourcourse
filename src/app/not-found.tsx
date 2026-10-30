import { StatusPage } from "@/components/website/status-page";

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist or has moved. Try Home, or browse every reviewer."
    />
  );
}
