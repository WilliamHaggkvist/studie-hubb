import * as React from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface Props {
  taskTitle?: string;
  courseName?: string | null;
  courseCode?: string | null;
  dueLabel?: string;
  timeLeftLabel?: string;
  taskType?: string;
  appUrl?: string;
}

const Email = ({
  taskTitle = "Uppgift",
  courseName = null,
  courseCode = null,
  dueLabel = "",
  timeLeftLabel = "",
  taskType = "",
}: Props) => {
  const courseDisplay = courseCode
    ? courseName
      ? `${courseCode} · ${courseName}`
      : courseCode
    : courseName;

  return (
    <Html lang="sv" dir="ltr">
      <Head />
      <Preview>{`Påminnelse: ${taskTitle} · ${timeLeftLabel}`}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={header}>
            <Text style={brand}>StudieHubb</Text>
          </Section>
          <Section style={card}>
            <Text style={eyebrow}>Påminnelse · {timeLeftLabel}</Text>
            <Heading style={h1}>{taskTitle}</Heading>
            {courseDisplay && (
              <Text style={meta}>
                {courseDisplay}
                {taskType ? ` · ${taskType}` : ""}
              </Text>
            )}
            {!courseDisplay && taskType && <Text style={meta}>{taskType}</Text>}
            <Text style={due}>
              Deadline: <strong>{dueLabel}</strong>
            </Text>
          </Section>
          <Text style={footer}>
            Du får detta mejl eftersom du har påminnelser aktiverade i StudieHubb.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Påminnelse: ${(d.taskTitle as string) ?? "uppgift"} — ${(d.timeLeftLabel as string) ?? "snart deadline"}`,
  displayName: "Deadline-påminnelse",
  previewData: {
    taskTitle: "Inlämning: Analys av datastrukturer",
    courseCode: "DD1338",
    courseName: "Algoritmer och datastrukturer",
    dueLabel: "imorgon 23:59",
    timeLeftLabel: "1 dag kvar",
    taskType: "Inlämning",
    appUrl: "https://studiehubb-xyz.lovable.app/tasks",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};
const container = { margin: "0 auto", padding: "24px 20px", maxWidth: "560px" };
const header = {
  backgroundColor: "#18181b",
  borderRadius: "12px 12px 0 0",
  padding: "16px 20px",
};
const brand = {
  fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
  color: "#ffffff",
};
const card = {
  borderRadius: "0 0 16px 16px",
  padding: "24px",
  backgroundColor: "#faf5f0",
  border: "1px solid #f3e5d5",
  borderTop: "none",
};
const eyebrow = {
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#c05621",
  margin: "0 0 8px",
};
const h1 = {
  fontSize: "22px",
  lineHeight: "28px",
  fontWeight: 700,
  color: "#1a1a1a",
  margin: "0 0 6px",
};
const meta = { fontSize: "13px", color: "#6b7280", margin: "0 0 12px" };
const due = { fontSize: "15px", color: "#111827", margin: "8px 0 0" };
const footer = {
  fontSize: "11px",
  color: "#9ca3af",
  textAlign: "center" as const,
  marginTop: "20px",
};
