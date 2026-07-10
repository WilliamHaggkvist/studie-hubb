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
  Button,
  Hr,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface TaskItem {
  title: string;
  courseName?: string | null;
  dueLabel?: string;
}
interface SessionItem {
  title: string;
  startLabel: string;
}
interface Props {
  displayName?: string;
  dateLabel?: string;
  tasks?: TaskItem[];
  sessions?: SessionItem[];
  appUrl?: string;
}

const Email = ({
  displayName = "",
  dateLabel = "",
  tasks = [],
  sessions = [],
  appUrl = "https://studiehubb-xyz.lovable.app",
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`Din dag: ${tasks.length} uppgifter, ${sessions.length} studiepass`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>StudieHubb</Text>
        <Section style={card}>
          <Text style={eyebrow}>Dagens plan · {dateLabel}</Text>
          <Heading style={h1}>God morgon{displayName ? `, ${displayName}` : ""}!</Heading>

          <Text style={sectionTitle}>Uppgifter idag/imorgon</Text>
          {tasks.length === 0 ? (
            <Text style={empty}>Inga uppgifter med deadline just nu 🎉</Text>
          ) : (
            tasks.map((t, i) => (
              <div key={i} style={row}>
                <Text style={rowTitle}>{t.title}</Text>
                <Text style={rowMeta}>
                  {[t.courseName, t.dueLabel].filter(Boolean).join(" · ")}
                </Text>
              </div>
            ))
          )}

          <Hr style={hr} />
          <Text style={sectionTitle}>Studiepass idag</Text>
          {sessions.length === 0 ? (
            <Text style={empty}>Inga inplanerade pass.</Text>
          ) : (
            sessions.map((s, i) => (
              <div key={i} style={row}>
                <Text style={rowTitle}>{s.title}</Text>
                <Text style={rowMeta}>{s.startLabel}</Text>
              </div>
            ))
          )}

          <Button href={appUrl} style={button}>
            Öppna StudieHubb
          </Button>
        </Section>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Din dag i StudieHubb — ${(d.dateLabel as string) ?? ""}`,
  displayName: "Daglig sammanfattning",
  previewData: {
    displayName: "Alex",
    dateLabel: "måndag 8 juli",
    tasks: [
      { title: "Läsa kap 4", courseName: "DD1338", dueLabel: "imorgon 12:00" },
      { title: "Labbrapport 2", courseName: "SG1140", dueLabel: "fredag 23:59" },
    ],
    sessions: [{ title: "Djupfokus algoritmer", startLabel: "09:00–11:00" }],
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};
const container = { margin: "0 auto", padding: "24px 20px", maxWidth: "560px" };
const brand = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: "20px",
  fontWeight: 700,
  margin: "0 0 16px",
  color: "#f94144",
};
const card = {
  borderRadius: "16px",
  padding: "24px",
  backgroundColor: "#faf5f0",
  border: "1px solid #f3e5d5",
};
const eyebrow = {
  fontSize: "12px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "#c05621",
  margin: "0 0 6px",
};
const h1 = {
  fontSize: "22px",
  lineHeight: "28px",
  fontWeight: 700,
  color: "#1a1a1a",
  margin: "0 0 16px",
};
const sectionTitle = { fontSize: "13px", fontWeight: 600, color: "#374151", margin: "12px 0 6px" };
const row = { padding: "8px 0", borderBottom: "1px solid #f3e5d5" };
const rowTitle = { fontSize: "14px", color: "#111827", margin: 0, fontWeight: 500 };
const rowMeta = { fontSize: "12px", color: "#6b7280", margin: "2px 0 0" };
const empty = { fontSize: "13px", color: "#6b7280", margin: "4px 0 8px" };
const hr = { borderColor: "#f3e5d5", margin: "16px 0" };
const button = {
  marginTop: "20px",
  backgroundImage: "linear-gradient(90deg,#f94144,#f8961e)",
  color: "#ffffff",
  padding: "12px 20px",
  borderRadius: "10px",
  fontWeight: 600,
  textDecoration: "none",
  display: "inline-block",
};
