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
  code?: string;
}

const Email = ({ code = "123456" }: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>Verifieringskod för påminnelser: {code}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Text style={brand}>StudieHubb</Text>
        </Section>
        <Section style={card}>
          <Text style={eyebrow}>Verifiering</Text>
          <Heading style={h1}>Verifiera din e-postadress</Heading>
          <Text style={textStyle}>
            Du har begärt att få påminnelser från StudieHubb skickade till denna e-postadress.
            Använd följande kod för att slutföra verifieringen:
          </Text>
          <Section style={codeContainer}>
            <Text style={codeStyle}>{code}</Text>
          </Section>
          <Text style={meta}>Koden är giltig i 15 minuter.</Text>
        </Section>
        <Text style={footer}>Om du inte har begärt detta kan du bortse från detta mejl.</Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) =>
    `Verifiera din e-postadress för StudieHubb: ${(d.code as string) ?? "kod"}`,
  displayName: "Verifiera e-post",
  previewData: {
    code: "987654",
  },
} satisfies TemplateEntry;

const main = {
  backgroundColor: "#ffffff",
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};
const container = { margin: "0 auto", padding: "24px 20px", maxWidth: "560px" };
const header = { padding: "4px 0 20px" };
const brand = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: "20px",
  fontWeight: 700,
  margin: 0,
  background: "linear-gradient(90deg,#f94144,#f8961e,#f9c74f)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent" as const,
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
  margin: "0 0 8px",
};
const h1 = {
  fontSize: "22px",
  lineHeight: "28px",
  fontWeight: 700,
  color: "#1a1a1a",
  margin: "0 0 12px",
};
const textStyle = { fontSize: "15px", color: "#374151", margin: "0 0 20px", lineHeight: "22px" };
const codeContainer = {
  background: "#f1f5f9",
  borderRadius: "8px",
  padding: "16px",
  textAlign: "center" as const,
  margin: "20px 0",
};
const codeStyle = {
  fontSize: "32px",
  fontWeight: 700,
  letterSpacing: "8px",
  color: "#1e293b",
  margin: 0,
};
const meta = { fontSize: "12px", color: "#6b7280", margin: "0 0 12px" };
const footer = {
  fontSize: "11px",
  color: "#9ca3af",
  textAlign: "center" as const,
  marginTop: "20px",
};
