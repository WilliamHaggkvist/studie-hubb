import * as React from 'react'
import { Body, Container, Head, Heading, Html, Preview, Section, Text, Button } from '@react-email/components'
import type { TemplateEntry } from './registry'

interface TaskItem { title: string; courseName?: string | null; dueLabel?: string }
interface Props {
  displayName?: string
  weekLabel?: string
  tasks?: TaskItem[]
  studyHours?: number
  appUrl?: string
}

const Email = ({
  displayName = '',
  weekLabel = '',
  tasks = [],
  studyHours = 0,
  appUrl = 'https://studiehubb.lovable.app',
}: Props) => (
  <Html lang="sv" dir="ltr">
    <Head />
    <Preview>{`Veckan som kommer: ${tasks.length} uppgifter`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>StudieHubb</Text>
        <Section style={card}>
          <Text style={eyebrow}>Veckoöversikt · {weekLabel}</Text>
          <Heading style={h1}>God kväll{displayName ? `, ${displayName}` : ''}!</Heading>
          <Text style={intro}>Du studerade <strong>{studyHours} timmar</strong> denna vecka. Här är det som väntar:</Text>

          {tasks.length === 0 ? (
            <Text style={empty}>Inga uppgifter med deadline nästa vecka 🎉</Text>
          ) : tasks.map((t, i) => (
            <div key={i} style={row}>
              <Text style={rowTitle}>{t.title}</Text>
              <Text style={rowMeta}>{[t.courseName, t.dueLabel].filter(Boolean).join(' · ')}</Text>
            </div>
          ))}

          <Button href={appUrl} style={button}>Planera veckan</Button>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Record<string, unknown>) => `Din vecka i StudieHubb — ${(d.weekLabel as string) ?? ''}`,
  displayName: 'Veckosammanfattning',
  previewData: {
    displayName: 'Alex',
    weekLabel: 'v.28',
    studyHours: 12,
    tasks: [
      { title: 'Tenta Analys', courseName: 'SF1625', dueLabel: 'onsdag 08:00' },
      { title: 'Redovisning grupp', courseName: 'DD1338', dueLabel: 'torsdag 13:00' },
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }
const container = { margin: '0 auto', padding: '24px 20px', maxWidth: '560px' }
const brand = { fontFamily: '"Space Grotesk", sans-serif', fontSize: '20px', fontWeight: 700, margin: '0 0 16px', color: '#f94144' }
const card = { borderRadius: '16px', padding: '24px', backgroundColor: '#faf5f0', border: '1px solid #f3e5d5' }
const eyebrow = { fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: '#c05621', margin: '0 0 6px' }
const h1 = { fontSize: '22px', lineHeight: '28px', fontWeight: 700, color: '#1a1a1a', margin: '0 0 12px' }
const intro = { fontSize: '14px', color: '#374151', margin: '0 0 16px' }
const row = { padding: '8px 0', borderBottom: '1px solid #f3e5d5' }
const rowTitle = { fontSize: '14px', color: '#111827', margin: 0, fontWeight: 500 }
const rowMeta = { fontSize: '12px', color: '#6b7280', margin: '2px 0 0' }
const empty = { fontSize: '13px', color: '#6b7280', margin: '4px 0 8px' }
const button = { marginTop: '20px', backgroundImage: 'linear-gradient(90deg,#f94144,#f8961e)', color: '#ffffff', padding: '12px 20px', borderRadius: '10px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }
