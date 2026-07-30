import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/auth/session";
import { exportArtifactVersion, isExportFormat } from "@/lib/exports";

// Node runtime: Prisma and the export serializers are not edge-compatible.
export const runtime = "nodejs";

/**
 * Download a committed artifact version as YAML or JSON. Authorization is
 * server-side (CLAUDE.md section 6): the caller must be signed in and hold a
 * role in the artifact's workspace — a share of this URL is not a share of the
 * artifact.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ versionId: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return new Response("Sign in to export artifacts.", { status: 401 });
  }

  const formatParam = request.nextUrl.searchParams.get("format");
  const format = isExportFormat(formatParam) ? formatParam : "yaml";

  const { versionId } = await params;
  const version = await prisma.artifactVersion.findUnique({
    where: { id: versionId },
    include: { artifact: { select: { slug: true, product: { select: { workspaceId: true } } } } },
  });
  if (!version) {
    return new Response("No such artifact version.", { status: 404 });
  }

  const member = await prisma.roleAssignment.findFirst({
    where: { userId: user.id, workspaceId: version.artifact.product.workspaceId },
    select: { id: true },
  });
  if (!member) {
    return new Response("You are not a member of this artifact's workspace.", { status: 403 });
  }

  const file = exportArtifactVersion(
    {
      slug: version.artifact.slug,
      versionNumber: version.versionNumber,
      contentJson: version.contentJson,
    },
    format,
  );

  return new Response(file.body, {
    status: 200,
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `attachment; filename="${file.filename}"`,
      // A version is immutable, so its export is too.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
