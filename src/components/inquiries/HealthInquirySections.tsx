import { Calculator, HeartPulse, Mail, MapPin, ShieldCheck, UserRound, UsersRound, Wallet, type LucideIcon } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'
import { InquiryInformationSection, InquirySection } from './InquiryWorkspacePanels'
import {
  customerObject, healthAnswer, healthBirthDate, healthChoice, healthMoney,
  parseHealthCustomerData, type CustomerAnswers,
} from '../../lib/healthInquiry'

type HealthField = readonly [label: string, value: string]

function HealthFields({ fields }: { fields: HealthField[] }) {
  return (
    <dl className="grid gap-4 md:grid-cols-2">
      {fields.map(([label, value]) => (
        <div key={label} className="min-w-0 space-y-2.5">
          <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
          <dd className="form-field-surface min-h-[46px] break-words rounded-2xl border border-border-soft px-4 py-3 text-[13px] font-medium text-foreground">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function personFields(person: CustomerAnswers, currency: unknown): HealthField[] {
  return [
    ['Full Name', healthAnswer(person.fullName)],
    ['Date of Birth', healthBirthDate(person.dateOfBirth)],
    ['Age', healthAnswer(person.age)],
    ['Gender', healthChoice(person.gender)],
    ['Insured', healthAnswer(person.insured)],
    ['Reference Premium', healthMoney(person.referencePremium, currency)],
    ['Premium Status', healthChoice(person.premiumStatus)],
  ]
}

function initials(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() : '?'
}

function ProfileGroup({ title, icon: Icon, fields }: { title: string; icon: LucideIcon; fields: HealthField[] }) {
  return <section className="space-y-4"><h4 className="flex items-center gap-2 border-b border-border-soft pb-3 text-xs font-semibold"><Icon className="h-4 w-4 text-primary" />{title}</h4><HealthFields fields={fields} /></section>
}

function PersonProfile({ person, currency, confirmed, contactFields }: { person: CustomerAnswers; currency: unknown; confirmed?: unknown; contactFields?: HealthField[] }) {
  const fields = personFields(person, currency)
  return <div className="grid items-start gap-7 xl:grid-cols-2">
    <div className="space-y-7"><ProfileGroup title="Personal Details" icon={UserRound} fields={fields.slice(1, 4)} />
      {contactFields ? <ProfileGroup title="Contact & Background" icon={Mail} fields={contactFields} /> : null}</div>
    <ProfileGroup title="Insurance & Pricing" icon={Wallet} fields={[...fields.slice(4), ...(confirmed !== undefined ? [['Details Confirmed', healthAnswer(confirmed)] as HealthField] : [])]} />
  </div>
}

export function HealthInquirySections({ customerData, includePremium = true, expanded = false }: { customerData?: string; includePremium?: boolean; expanded?: boolean }) {
  const data = parseHealthCustomerData(customerData)
  const Section = expanded ? InquiryInformationSection : InquirySection
  if (!data) {
    return (
      <Section title="Health Insurance Information" icon={HeartPulse}>
        <p className="text-[13px] text-muted-foreground">Health insurance information is not available for this inquiry.</p>
      </Section>
    )
  }
  const salary = typeof data.applicant.salaryBand === 'string' && data.applicant.salaryBand.startsWith('below_')
    ? `Below ${data.applicant.salaryBand.slice(6).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
    : healthChoice(data.applicant.salaryBand)
  const people = [
    { key: 'applicant', person: data.applicant, relationship: 'Primary Applicant', confirmed: undefined as unknown, applicant: true },
    ...data.members.map((member, index) => {
      const confirmed = customerObject(member.confirmedDetails)
      return { key: `dependent-${typeof member.id === 'string' ? member.id : index}`, person: { ...member, fullName: member.fullName ?? confirmed.fullName, dateOfBirth: member.dateOfBirth ?? confirmed.dateOfBirth, gender: member.gender ?? confirmed.gender }, relationship: healthChoice(member.relationship), confirmed: member.saved ?? null, applicant: false }
    }),
  ]
  return (
    <>
      <Section title="Health Coverage & Residency" icon={HeartPulse}>
        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Coverage', value: healthChoice(data.coverageTarget), icon: ShieldCheck },
            { label: 'Insured People', value: healthAnswer(data.premium.totalPeople), icon: UsersRound },
            { label: 'Residency', value: healthAnswer(data.visaEmirate), icon: MapPin },
          ].map(({ label, value, icon: Icon }) => <div key={label} className="flex items-start gap-3 rounded-xl border border-border-soft bg-surface-soft/50 p-4"><span className="rounded-lg bg-primary/10 p-2 text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0"><p className="text-[11px] text-muted-foreground">{label}</p><p className="mt-1 break-words text-[13px] font-semibold">{value}</p></div></div>)}
        </div>
        <HealthFields fields={[
          ['Visa Type', healthChoice(data.visaType)],
          ['Nationality Code', healthAnswer(data.nationalityCode)],
          ['Visa Status', healthChoice(data.visaStatus)],
          ['Currency', healthAnswer(data.currency)],
        ]} />
      </Section>
      <Section title="Insured People" icon={UsersRound}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><p className="text-xs leading-5 text-muted-foreground">Applicant and dependent information, all in one place.</p><span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-medium text-primary">1 applicant · {data.members.length} {data.members.length === 1 ? 'dependent' : 'dependents'}</span></div>
        <Tabs defaultValue="applicant" key={people.map((item) => item.key).join('|')}>
          <TabsList aria-label="Applicant and dependents" className="mb-6 !grid auto-rows-fr grid-cols-1 gap-3 rounded-none border-0 bg-transparent p-0 sm:grid-cols-2 lg:grid-cols-3">
            {people.map(({ key, person, relationship }) => <TabsTrigger key={key} value={key} className="group min-w-0 items-stretch justify-start rounded-xl border border-border-soft px-4 py-3.5 text-left hover:bg-surface-soft data-[state=active]:!border-primary/40 data-[state=active]:!bg-primary/[0.06] data-[state=active]:!text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-3 [&>span]:whitespace-normal">
              <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-xs font-semibold text-muted-foreground group-data-[state=active]:bg-primary group-data-[state=active]:text-white">{initials(person.fullName)}</span>
              <span className="min-w-0 flex-1"><span className="block break-words text-[13px] font-semibold">{healthAnswer(person.fullName)}</span><span className="mt-1 block text-[11px] font-normal text-muted-foreground">{relationship}</span></span>
              <ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-primary opacity-0 group-data-[state=active]:opacity-100" />
            </TabsTrigger>)}
          </TabsList>
          {people.map(({ key, person, confirmed, applicant }) => <TabsContent key={key} value={key} className="border-t border-border-soft pt-6 outline-none">
            <PersonProfile person={person} currency={data.currency} confirmed={confirmed} contactFields={applicant ? [
              ['Marital Status', healthChoice(data.applicant.maritalStatus)],
              ['Salary Band', salary],
              ['Mobile Number', healthAnswer(data.applicant.mobile)],
              ['Email Address', healthAnswer(data.applicant.email)],
            ] : undefined} />
          </TabsContent>)}
        </Tabs>
      </Section>
      {includePremium ? <Section title="Health Premium Breakdown" icon={Calculator}>
        <HealthPremiumFields customerData={customerData} />
      </Section> : null}
    </>
  )
}

export function HealthPremiumFields({ customerData, excludeInquiryAmounts = false }: { customerData?: string; excludeInquiryAmounts?: boolean }) {
  const data = parseHealthCustomerData(customerData)
  if (!data) return <p className="text-xs text-muted-foreground">Submitted premium details are not available.</p>
  const fields: HealthField[] = [
    ['People Included', healthAnswer(data.premium.totalPeople)],
    ['People Priced', healthAnswer(data.premium.pricedPeople)],
  ]
  if (!excludeInquiryAmounts) fields.push(['Gross Premium', healthMoney(data.premium.grossPremium, data.currency)])
  fields.push(
    ['VAT Percentage', typeof data.premium.vatPercent === 'number' ? `${healthAnswer(data.premium.vatPercent)}%` : 'Not provided'],
    ['VAT Amount', healthMoney(data.premium.vatAmount, data.currency)],
  )
  if (!excludeInquiryAmounts) fields.push(['Total Amount to Charge', healthMoney(data.premium.totalAmountCharge, data.currency)])
  fields.push(
    ['Pricing Complete', healthAnswer(data.premium.complete)],
    ['Rounding Method', data.premium.rounding === 'ceil-whole-unit' ? 'Round Up to Whole Unit' : healthChoice(data.premium.rounding)],
  )
  return <HealthFields fields={fields} />
}
