// One-off loader for researched school data (checked 2026-09-23 against official pages).
// Only facts stated on the cited pages are included; unknowns are deliberately left null so they
// appear under "Still to research" in the app. Re-verify dates before relying on them.
//   node scripts/research-2026-09.mjs           -> prints the SQL
//   node scripts/research-2026-09.mjs --apply   -> runs it against the Supabase project
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKED = "2026-09-23";
const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const schools = [
  {
    name: "Carnegie Mellon University",
    profile: {
      city: "Pittsburgh, PA",
      application_url: "https://admissions.scs.cmu.edu/portal/apply_gr",
      admissions_url: "https://www.cs.cmu.edu/education/graduate-admissions",
      application_fee: 80, fee_currency: "USD",
      fee_waiver: "$80 if you apply by the early deadline (Nov 18, 2026), $100 after. Fee waiver for financial hardship is available inside the application.",
      gre_policy: "optional",
      english_test: "TOEFL required if English is not your native language, no exceptions (IELTS may also be submitted). Old scores are OK if you studied for a US degree.",
      letters_required: 3,
      writing_sample: "No writing sample. Required: statement of purpose, CV/resume, official transcripts. A 1-3 minute video essay is optional but strongly recommended (the LTI says it gives an advantage).",
      program_length: "5 years (LTI publishes a sample five-year schedule)",
      deadline_date: "2026-12-09",
      deadline_note: "Fall 2027 cycle. Application opens Sep 9, 2026. Early deadline Nov 18, 2026; final deadline Dec 9, 2026 (both 3 p.m. EST).",
    },
    dept: {
      name: "Language Technologies Institute (LTI)", program: "PhD in Language and Information Technology",
      url: "https://www.lti.cs.cmu.edu/", admissions_url: "https://www.lti.cs.cmu.edu/apply/index.html", deadline_date: "2026-12-09",
      requirements: "3 letters, statement of purpose, CV, transcripts, TOEFL if non-native English (GRE optional). Outside funding needs an official award letter.",
      notes: "Sources: lti.cs.cmu.edu/apply, lti.cs.cmu.edu/academics/phd-programs/phd-lti.html, cs.cmu.edu/education/graduate-admissions. Checked " + CHECKED + ".",
    },
    professors: [
      {
        name: "Graham Neubig", title: "Associate Professor", areas: ["natural language processing", "large language models", "multilingual NLP", "code and software agents"],
        summary: "Research on NLP and large language models: fundamental advances in model capabilities and applications such as software development. Long-term goal: break down barriers in human-human and human-machine communication.",
        homepage: "https://www.lti.cs.cmu.edu/people/faculty/neubig-graham.html", accepting: "unknown", notes: "Openings for the coming cycle not stated on his LTI profile.",
      },
      {
        name: "Daniel Fried", title: "Assistant Professor", areas: ["language model agents", "code generation", "computer and web use", "reasoning"],
        summary: "Works on enabling people and LM agents to communicate and collaborate on real-world tasks: writing code, using computers and the web, and reasoning.",
        homepage: "https://dpfried.github.io/", accepting: "unknown",
        notes: "His page says CMU students interested in working with him should check back in December for possible Spring 2027 openings. PhD-admit openings not stated.",
      },
      {
        name: "Maarten Sap", title: "Assistant Professor (LTI; courtesy HCII; part-time at Ai2)", areas: ["social and interactional intelligence of AI", "bias and safety in language", "narrative language technologies"],
        summary: "Measures and improves AI systems' social intelligence; assesses and combats social inequality, safety risks and socio-cultural bias in human- or AI-generated language; builds narrative language technologies for prosocial outcomes.",
        homepage: "https://maartensap.com/", accepting: "no",
        notes: "His page states: \"Due to my lab being quite full already, I'm not looking for any new students in this upcoming PhD application cycle.\"",
      },
      {
        name: "Sean Welleck", title: null, areas: ["AI reasoning", "formal and informal mathematics", "generative models"],
        summary: "Overarching theme: bridging informal and formal reasoning with AI, across deep learning and generative models.",
        homepage: "https://wellecks.com/", accepting: "unknown", notes: null,
      },
    ],
  },
  {
    name: "Stanford University",
    profile: {
      city: "Stanford, CA",
      application_url: "https://gradadmissions.stanford.edu/apply",
      admissions_url: "https://www.cs.stanford.edu/admissions/phd-admissions",
      application_fee: 125, fee_currency: "USD",
      fee_waiver: "Waivers available through Stanford Graduate Admissions if you cannot pay by credit card or the fee is a financial burden.",
      gre_policy: "not_accepted",
      english_test: "TOEFL required if your first language is not English, regardless of citizenship. IELTS Academic accepted as an equivalent. Score must be under 24 months old and taken before the deadline (suggested by October 2026). Exempt if you earned a degree taught entirely in English.",
      writing_sample: null,
      deadline_date: "2026-12-08",
      deadline_note: "Autumn 2027 entry. Application opens Sep 15, 2026. Deadlines are final. PhD decisions expected February 2027. Only one admissions cycle per year.",
    },
    dept: {
      name: "Computer Science", program: "PhD", url: "https://www.cs.stanford.edu/", admissions_url: "https://www.cs.stanford.edu/admissions/phd-admissions", deadline_date: "2026-12-08",
      requirements: "GRE not considered. TOEFL for non-native English speakers (IELTS Academic accepted). Apply directly to the PhD (the MS is a separate program).",
      notes: "Sources: cs.stanford.edu graduate deadlines and PhD FAQ; gradadmissions.stanford.edu/apply/application-fee. Checked " + CHECKED + ". Letter count and funding terms were not stated on the pages read.",
    },
    professors: [
      {
        name: "Percy Liang", title: null, areas: ["foundation models", "language model evaluation", "machine learning"],
        summary: "Interested in fundamental questions around learning and intelligence; a strong proponent of efficient and reproducible research. Leads work on holistic evaluation of language models (HELM) at the Center for Research on Foundation Models.",
        homepage: "https://cs.stanford.edu/~pliang/", accepting: "unknown", notes: null,
      },
      {
        name: "Christopher Manning", title: "Thomas M. Siebel Professor in Machine Learning; Professor of Linguistics and of Computer Science", areas: ["natural language processing", "deep learning for NLP"],
        summary: "Stanford NLP Group leader; co-founder and senior fellow of the Stanford Institute for Human-Centered AI (HAI).",
        homepage: "https://nlp.stanford.edu/~manning/", accepting: "unknown", notes: null,
      },
      {
        name: "Dan Jurafsky", title: "Reynolds Professor in Humanities", areas: ["natural language processing", "language and society"],
        summary: "Studies NLP and its implications for society and its application to other fields. MacArthur Fellow.",
        homepage: "https://web.stanford.edu/~jurafsky/", accepting: "unknown", notes: null,
      },
      {
        name: "Diyi Yang", title: "Assistant Professor", areas: ["socially aware NLP", "large language models"],
        summary: "Affiliated with the Stanford NLP Group, HCI Group, SAIL and HAI. Interested in socially aware NLP and large language models. PhD from CMU LTI.",
        homepage: "https://cs.stanford.edu/~diyiy/", accepting: "unknown", notes: null,
      },
      {
        name: "Tatsunori Hashimoto", title: "Assistant Professor", areas: ["robust and trustworthy machine learning", "large language models", "statistics for ML"],
        summary: "Uses statistical tools to make machine learning systems more robust and trustworthy, especially large language models, with robustness and worst-case performance as a lens.",
        homepage: "https://thashim.github.io/", accepting: "unknown", notes: null,
      },
    ],
  },
  {
    name: "Johns Hopkins University",
    profile: {
      city: "Baltimore, MD",
      admissions_url: "https://www.cs.jhu.edu/academic-programs/graduate-studies/phd-program/phd-admissions-faqs/",
      gre_policy: "optional",
      english_test: "TOEFL or IELTS required for non-native English speakers (waivers only for citizens of, or degree holders from, English-instruction countries). No minimum scores, but JHU prefers TOEFL iBT 100 and IELTS Academic 7.",
      funding_guarantee: "The CS PhD page says all PhD students receive support including an annual stipend, through external and internal competitive fellowships, research fellowships or teaching fellowships.",
      deadline_date: "2026-12-15",
      deadline_note: "Fall entry only (no recruiting for spring). Application typically opens around Aug 15. The department FAQ gives Dec 15; re-check the 2026-27 date on the application page.",
    },
    dept: {
      name: "Computer Science (Whiting School of Engineering)", program: "PhD", url: "https://www.cs.jhu.edu/",
      admissions_url: "https://www.cs.jhu.edu/academic-programs/graduate-studies/phd-program/phd-admissions-faqs/", deadline_date: "2026-12-15",
      requirements: "GRE optional. TOEFL/IELTS for non-native speakers (no minimums; TOEFL 100 / IELTS 7 preferred). Undergraduate CS degree not required, but expect coursework in programming, data structures, automata theory, systems fundamentals and algorithms.",
      notes: "Sources: cs.jhu.edu PhD admissions FAQ and PhD program page. Checked " + CHECKED + ". Fee and letter count not stated on the pages read (the Whiting School application page blocked automated access).",
    },
    professors: [
      {
        name: "Philipp Koehn", title: "Professor", areas: ["machine translation", "natural language processing"],
        summary: "Professor at Johns Hopkins; known for machine translation research and the WMT shared tasks. Member of the Center for Language and Speech Processing (CLSP).",
        homepage: "https://www.cs.jhu.edu/~phi/", accepting: "unknown", notes: "Research areas are from his long-standing MT work; his homepage itself lists only his title.",
      },
      {
        name: "Kevin Duh", title: "Associate Research Professor; Senior Research Scientist at HLTCOE", areas: ["machine translation", "human language technology"],
        summary: "Senior research scientist at the JHU Human Language Technology Center of Excellence; associate research professor in Computer Science and member of CLSP.",
        homepage: "https://www.cs.jhu.edu/~kevinduh/", accepting: "unknown",
        notes: "Research-track (not tenure-track) appointment, so check whether he can be your primary PhD advisor. His page says he cannot reply to individual inquiries; point admissions questions to the official CS page.",
      },
      {
        name: "Mark Dredze", title: "John C. Malone Professor of Computer Science", areas: ["generative AI safety", "natural language processing", "machine learning"],
        summary: "Recent work on defining the scope of acceptable inputs and outputs for responsible generative AI products.",
        homepage: "https://www.cs.jhu.edu/~mdredze/", accepting: "unknown", notes: null,
      },
      {
        name: "Daniel Khashabi", title: null, areas: ["reasoning-driven AI systems", "natural language processing"],
        summary: "Interested in making reasoning-driven AI systems more helpful. Previously a postdoc at the Allen Institute for AI.",
        homepage: "https://danielkhashabi.com/", accepting: "unknown", notes: "His site has an 'Information for Prospective Students' section worth reading before contacting him.",
      },
      {
        name: "Benjamin Van Durme", title: "Professor", areas: ["information extraction", "reasoning over documents and images", "natural language processing"],
        summary: "Helps people work with large amounts of information: finding and reasoning over what is expressed in documents and images. Member of CLSP.",
        homepage: "https://www.cs.jhu.edu/~vandurme/", accepting: "unknown", notes: null,
      },
    ],
  },
  {
    name: "University of Washington-Seattle Campus",
    profile: {
      city: "Seattle, WA",
      application_url: "https://www.cs.washington.edu/academics/graduate/phd-program/phd-admissions/how-apply/",
      admissions_url: "https://www.cs.washington.edu/academics/graduate/phd-program/phd-admissions/",
      application_fee: 90, fee_currency: "USD",
      fee_waiver: "The UW Graduate School offers fee waivers to some domestic applicants with financial need. The Allen School does not offer department-level waivers.",
      gre_policy: "not_accepted",
      english_test: "Non-native speakers must show proficiency unless they hold a degree taught in English (US, Canada, UK, Australia and other listed countries). Accepted tests: TOEFL, IELTS 7.0+, Duolingo English Test 120+. Scores valid two years.",
      letters_required: 3,
      writing_sample: "No writing sample. Required: personal statement, CV describing research accomplishments, unofficial transcripts.",
      program_length: "About 6 years on average",
      funding_guarantee: "3 years of guaranteed financial support (teaching and research assistantships or fellowships), with a tuition waiver and a monthly stipend.",
      tuition_note: "Tuition waived except roughly $250 per quarter in fees (Allen School FAQ).",
      acceptance_note: "In 2023: over 3,000 applications and about 150 offers. Average GPA of admits 3.8, though GPA is not a major factor; holistic review emphasising research potential.",
      deadline_date: "2026-12-15",
      deadline_note: "11:59 pm Pacific, Dec 15 (next business day if it falls on a weekend). One admissions cycle per year; decisions in late February.",
    },
    dept: {
      name: "Paul G. Allen School of Computer Science & Engineering", program: "PhD", url: "https://www.cs.washington.edu/",
      admissions_url: "https://www.cs.washington.edu/academics/graduate/phd-program/phd-admissions/", deadline_date: "2026-12-15",
      requirements: "3 letters, personal statement, CV, transcripts, English proficiency if applicable. GRE is not accepted.",
      notes: "Sources: cs.washington.edu PhD how-to-apply and FAQ. Checked " + CHECKED + ". There is no standalone full-time master's; the PhD awards an MS on the way.",
    },
    professors: [
      {
        name: "Yulia Tsvetkov", title: "Associate Professor", areas: ["natural language processing", "reliable and socially aware AI", "multilingual and culturally inclusive modeling", "AI for health and science"],
        summary: "Develops language technologies that are reliable, socially aware and linguistically inclusive. Group work covers capabilities and limits of LLMs (reasoning, personalization), AI ethics and safety, multilingual modeling and high-stakes applications such as health.",
        homepage: "https://homes.cs.washington.edu/~yuliats/", accepting: "unknown", notes: "Adjunct professor at CMU LTI; previously assistant professor there.",
      },
      {
        name: "Noah A. Smith", title: "Professor; Vice Provost for Artificial Intelligence", areas: ["natural language processing", "language modeling"],
        summary: "Professor in the Allen School and UW's inaugural Vice Provost for Artificial Intelligence. Received the 2026 UW Faculty Lecture Award.",
        homepage: "https://nasmith.github.io/", accepting: "unknown", notes: "Heavy administrative role: confirm his advising capacity before applying.",
      },
      {
        name: "Hannaneh Hajishirzi", title: "Torode Family Professor; Senior Research Director at Ai2", areas: ["NLP", "language modeling (OLMo)", "post-training"],
        summary: "Research focused on NLP and language modeling: the science of language modeling through the OLMo project, post-training to make models useful, and a new generation of models.",
        homepage: "https://homes.cs.washington.edu/~hannaneh/", accepting: "unknown", notes: null,
      },
      {
        name: "Luke Zettlemoyer", title: "Professor; Research Director at Meta", areas: ["natural language semantics", "large language models", "machine learning"],
        summary: "Empirical methods for natural language semantics, including designing ML algorithms, new tasks and datasets, and how best to train and deploy large language models.",
        homepage: "https://www.cs.washington.edu/people/faculty/lsz", accepting: "unknown", notes: null,
      },
    ],
  },
  {
    name: "University of Illinois Urbana-Champaign",
    profile: {
      city: "Urbana-Champaign, IL",
      application_url: "https://siebelschool.illinois.edu/admissions/graduate/applications-process-requirements",
      admissions_url: "https://siebelschool.illinois.edu/admissions/graduate",
      application_fee: 90, fee_currency: "USD",
      fee_waiver: "Fee waivers available; questions to grad-admissions@siebelschool.illinois.edu. Fee applies to all applicants from the Spring 2026 cycle.",
      gre_policy: "optional",
      english_test: "TOEFL or IELTS required of all international applicants for admission and funding (Graduate College exceptions apply to admission only). PhD applicants may also need TOEFL iBT / IELTS speaking scores.",
      letters_required: 3,
      writing_sample: "No writing sample. Required: statement of purpose, CV/resume, unofficial transcripts (official ones only if admitted).",
      deadline_date: "2026-12-01",
      deadline_note: "Fall entry only. Deadline 11:59 pm US Central. Decisions released on a rolling basis up to the decision deadline of March 15. The school advises submitting a month early.",
    },
    dept: {
      name: "Siebel School of Computing and Data Science", program: "PhD in Computer Science", url: "https://siebelschool.illinois.edu/",
      admissions_url: "https://siebelschool.illinois.edu/admissions/graduate", deadline_date: "2026-12-01",
      requirements: "3 letters, statement of purpose, CV, transcripts, TOEFL/IELTS for international applicants. GRE optional.",
      notes: "Sources: siebelschool.illinois.edu application deadlines, requirements and checklist pages. Checked " + CHECKED + ". Funding terms were not confirmed on the pages read.",
    },
    professors: [
      {
        name: "Heng Ji", title: "Professor", areas: ["natural language processing", "multimodal knowledge extraction"],
        summary: "Leads the BLENDER lab. Her page invites PhD applicants to list her as a potential advisor.",
        homepage: "https://blender.cs.illinois.edu/hengji.html", accepting: "yes",
        notes: "Her page says: \"For PhD application please indicate me as one of the potential advisors if you are interested in working with me.\"",
      },
      {
        name: "Julia Hockenmaier", title: "Professor and Willett Faculty Scholar", areas: [],
        summary: "Professor in the Siebel School. Research areas not read from her profile; check her page.",
        homepage: "https://siebelschool.illinois.edu/about/people/faculty/juliahmr", accepting: "unknown", notes: null,
      },
      {
        name: "Dilek Hakkani-Tur", title: "Professor; Amazon Scholar", areas: ["conversational AI", "spoken dialogue systems", "natural language and speech processing", "machine learning for language"],
        summary: "Research in conversational AI and natural language and speech processing; designed the Alexa Prize SimBot Challenge on embodied task-driven agents.",
        homepage: "https://siebelschool.illinois.edu/about/people/faculty/dilek", accepting: "unknown", notes: null,
      },
      {
        name: "Hao Peng", title: "Assistant Professor", areas: ["large language models"],
        summary: "Broadly interested in large language models. PhD from the University of Washington with Noah Smith.",
        homepage: "https://haopeng-nlp.github.io/", accepting: "unknown", notes: null,
      },
    ],
  },
];

const q = (v) => (v === null || v === undefined ? "null" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(",")}]::text[]`;
const sid = (n) => `(select id from schools where name = ${q(n)})`;

let sql = "begin;\n";
for (const s of schools) {
  const p = s.profile;
  const cols = Object.entries(p).map(([k, v]) => `${k} = ${q(v)}`).join(", ");
  sql += `update schools set ${cols} where name = ${q(s.name)};\n`;
  const d = s.dept;
  sql += `insert into departments (owner_id, school_id, name, program, url, admissions_url, deadline_date, requirements, notes)
select owner_id, id, ${q(d.name)}, ${q(d.program)}, ${q(d.url)}, ${q(d.admissions_url)}, ${q(d.deadline_date)}, ${q(d.requirements)}, ${q(d.notes)}
from schools where name = ${q(s.name)}
and not exists (select 1 from departments x where x.school_id = schools.id and x.name = ${q(d.name)});\n`;
  const dept = `(select id from departments where school_id = ${sid(s.name)} and name = ${q(d.name)})`;
  for (const pr of s.professors) {
    // Keep the original "why matched" note (seeded from the school's fit note) below the verified summary.
    sql += `update professors set title = ${q(pr.title)}, department_id = ${dept}, research_areas = ${arr(pr.areas)},
  research_summary = ${q(pr.summary)} || coalesce(E'\\n\\nWhy matched: ' || research_summary, ''),
  homepage_url = ${q(pr.homepage)}, accepting = ${q(pr.accepting)}::accepting_status, notes = ${q(pr.notes)}
where school_id = ${sid(s.name)} and name = ${q(pr.name)};\n`;
    sql += `insert into professors (owner_id, school_id, department_id, name, title, research_areas, research_summary, homepage_url, accepting, notes)
select owner_id, id, ${dept}, ${q(pr.name)}, ${q(pr.title)}, ${arr(pr.areas)}, ${q(pr.summary)}, ${q(pr.homepage)}, ${q(pr.accepting)}::accepting_status, ${q(pr.notes)}
from schools where name = ${q(s.name)}
and not exists (select 1 from professors x where x.school_id = schools.id and x.name = ${q(pr.name)});\n`;
  }
}

// Verified funding programme with an explicit guarantee statement.
sql += `insert into fundings (owner_id, school_id, name, type, covers, url, status, notes)
select owner_id, id, 'Allen School PhD guaranteed support', 'assistantship', 'Tuition waiver (all but about $250/quarter in fees) and a monthly stipend, via TA/RA/fellowship',
  'https://www.cs.washington.edu/academics/graduate/phd-program/phd-admissions/faq/', 'eligible',
  '3 years of guaranteed financial support for every admitted PhD student (Allen School FAQ, checked ${CHECKED}). Stipend amount not stated on the page.'
from schools where name = 'University of Washington-Seattle Campus'
and not exists (select 1 from fundings f where f.school_id = schools.id and f.name = 'Allen School PhD guaranteed support');\n`;
sql += "commit;\n";

if (!process.argv.includes("--apply")) {
  console.log(sql);
} else {
  const token = readFileSync(join(root, ".supabase-token"), "utf8").trim();
  const res = await fetch("https://api.supabase.com/v1/projects/yzbpaoknnzdtrvowbvum/database/query", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: sql }),
  });
  console.log(res.status, (await res.text()).slice(0, 400));
}
