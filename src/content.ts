// Everything a visitor reads lives here, so updating the resume never means touching the 3D code.

export const profile = {
  name: 'Kulsum Timol',
  role: 'Full-stack developer',
  city: 'Toronto, ON',
  email: 'aarzootimol@gmail.com',
  linkedin: 'https://www.linkedin.com/in/kulsumtimol',
  github: 'https://github.com/kulsumtimol10',
  resume: 'Kulsum-Timol-Resume.pdf',
  summary:
    'Full-stack developer with production experience in React, TypeScript, Node.js and NestJS. I build responsive front ends and secure REST APIs on Firebase and Google Cloud, and I bring a systems and networking background to every project.',
  languages: ['English', 'Hindi', 'Gujarati'],
};

export type Job = { id: string; role: string; org: string; place: string; dates: string; bullets: string[]; stack: string[] };

export const experience: Job[] = [
  {
    id: 'needlist', role: 'Full-Stack Software Developer Co-op', org: 'Needlist.org', place: 'Remote, ON', dates: 'Jan 2026 – Aug 2026',
    bullets: [
      'Built and maintained full-stack features with TypeScript, React, Node.js and Express',
      'Designed REST APIs and managed Firebase (Firestore and Auth) for secure, role-based data access',
      'Wrote unit and integration tests with Jest and validated APIs with Postman',
      'Fixed front-end and back-end issues to improve performance and reliability',
      'Worked in Agile with Git and contributed technical documentation',
    ],
    stack: ['React', 'TypeScript', 'Node.js', 'Express', 'Firestore', 'Jest'],
  },
  {
    id: 'ta', role: 'Teaching Assistant (Volunteer)', org: 'Islamic Center of Oshawa', place: 'Oshawa, ON', dates: 'Jan 2025 – Aug 2025',
    bullets: [
      'Provided front-line support to students and staff, resolving technical and academic issues',
      'Assisted with coordination and cross-team communication',
    ],
    stack: [],
  },
  {
    id: 'trueline', role: 'Full Stack Developer', org: 'Trueline Solution', place: 'Surat, India', dates: 'Dec 2023 – Nov 2024',
    bullets: [
      'Maintained and monitored enterprise web applications for performance and availability',
      'Troubleshot technical issues and resolved service tickets',
      'Documented workflows, incidents and technical procedures',
      'Supported user onboarding and access management',
      'Worked with cross-functional teams on system enhancements',
    ],
    stack: ['Web apps', 'Troubleshooting', 'Access management'],
  },
];

export type Project = {
  id: string; title: string; kind: string; blurb: string; bullets: string[]; stack: string[];
  accent: string; icon: 'lock' | 'cloud' | 'film' | 'phone' | 'chart' | 'image'; link?: { label: string; href: string }; featured?: boolean;
};

export const projects: Project[] = [
  {
    id: 'securevault', title: 'SecureVault', kind: 'Security', featured: true, accent: '#1b9a62', icon: 'lock',
    blurb: 'A zero-knowledge password manager: the server never sees a plaintext credential.',
    bullets: [
      'AES-256-GCM encryption for stored credentials',
      'Hashed master passwords, account lockout and JWT-based sessions',
      'RESTful API over a normalized MySQL schema (11 tables, 3NF)',
    ],
    stack: ['AES-256-GCM', 'JWT', 'REST', 'MySQL'],
    link: { label: 'View on GitHub', href: 'https://github.com/kulsumtimol10/SecureVault' },
  },
  {
    id: 'ecs', title: 'Microservices storefront on AWS', kind: 'Team project · Cloud', accent: '#d9741a', icon: 'cloud',
    blurb: 'An Amazon-style store built by a team of four as order, product and user microservices.',
    bullets: [
      'Docker services on ECS Fargate behind one shared load balancer, each with its own DynamoDB table',
      'Event-driven sign-up flow: SQS to Lambda to SNS email',
      'React SPA on S3 with Cognito auth',
      'All infrastructure in Terraform, deployed by keyless GitHub Actions (OIDC)',
    ],
    stack: ['AWS ECS', 'Docker', 'Terraform', 'Lambda', 'React'],
    link: { label: 'View on GitHub', href: 'https://github.com/kulsumtimol10/e-commerce-ECS-microservices' },
  },
  {
    id: 'movies', title: 'Movie Recommendation System', kind: 'Machine learning', accent: '#d2365c', icon: 'film',
    blurb: 'A recommendation engine with a Streamlit front end and live TMDB data.',
    bullets: ['Improved accuracy by 20% through feature engineering and iterative testing', 'Developed and documented the full ML pipeline in Python'],
    stack: ['Python', 'scikit-learn', 'Streamlit', 'TMDB API'],
  },
  {
    id: 'grocery', title: 'Grocery Store App', kind: 'Mobile', accent: '#139067', icon: 'phone',
    blurb: 'A cross-platform mobile app with inventory tracking and order management.',
    bullets: ['User authentication with Firebase', 'Admin modules for product management'],
    stack: ['Flutter', 'Dart', 'Firebase'],
  },
  {
    id: 'shop', title: 'E-Commerce Website', kind: 'Web', accent: '#3b5fd4', icon: 'chart',
    blurb: 'A web store with authentication, product management and analytics dashboards.',
    bullets: ['Optimized database queries to speed up reporting'],
    stack: ['JSP', 'Servlets', 'MySQL'],
  },
  {
    id: 'image', title: 'Image Editing Website', kind: 'Web', accent: '#b8830d', icon: 'image',
    blurb: 'A browser-based image editor with a Python processing back end.',
    bullets: [],
    stack: ['PHP', 'Python', 'MySQL'],
  },
];

export const education = [
  {
    school: 'Seneca Polytechnic', place: 'Toronto, ON', credential: 'Graduate Certificate, Business Information Technology', dates: 'Jan 2025 – Aug 2026',
    score: '3.8', scoreLabel: 'GPA out of 4.0',
    notes: ['Windows Server, Active Directory and Group Policy in VMware', 'Linux administration and shell scripting', 'Secure networking: VLANs, NAT, OSPF, ACLs and port security'],
  },
  {
    school: 'SRKI, Sarvajanik University', place: 'Surat, India', credential: 'Bachelor of Science, Information Technology', dates: 'Aug 2021 – May 2024',
    score: '9.13', scoreLabel: 'CGPA, First Class with Distinction',
    notes: [],
  },
];

export const coreStack = ['React', 'TypeScript', 'Node.js', 'NestJS', 'Firebase', 'Google Cloud', 'REST APIs', 'Jest'];

export const skills: { group: string; items: string[] }[] = [
  { group: 'Frontend', items: ['TypeScript', 'JavaScript (ES6+)', 'React', 'TanStack', 'Redux (RTK Query)', 'HTML5', 'CSS3', 'Responsive design'] },
  { group: 'Backend and data', items: ['Node.js', 'NestJS (Fastify)', 'Express', 'REST APIs', 'Firebase (Firestore, Auth)', 'SQL / MySQL', 'Python (NumPy, pandas)'] },
  { group: 'Cloud and DevOps', items: ['Google Cloud (gcloud SDK)', 'Git / GitHub', 'CI/CD', 'AWS and Azure fundamentals'] },
  { group: 'Testing and process', items: ['Jest', 'React Testing Library', 'Postman', 'Code reviews', 'Agile / Scrum', 'Technical documentation'] },
  { group: 'Systems and security', items: ['Windows Server', 'Active Directory', 'Linux (Ubuntu)', 'VMware', 'VLANs, NAT, ACLs', 'Cisco routing and switching'] },
];

export const certifications = [
  { name: 'Networking Basics', issuer: 'Cisco', year: '2025' },
  { name: 'Cybersecurity Fundamentals', issuer: 'IBM', year: '2025' },
  { name: 'Introduction to Cybersecurity', issuer: 'Cisco', year: '2025' },
  { name: 'Fundamentals of Predictive Project Management', issuer: 'PMI', year: '2025' },
  { name: 'Fundamentals of Agile Project Management', issuer: 'PMI', year: '2025' },
  { name: 'Google AI Fundamentals', issuer: 'Google', year: '2026' },
];

export type Stop = {
  id: string;
  nav: string;
  kicker: string;
  title: string;
  body: string;
  bullets?: string[];
  chips?: string[];
  link?: { label: string; href: string };
  contact?: boolean;
};

const job = Object.fromEntries(experience.map((j) => [j.id, j]));
const proj = Object.fromEntries(projects.map((p) => [p.id, p]));
const projectStop = (id: string, nav: string): Stop => {
  const p = proj[id];
  return { id, nav, kicker: p.kind, title: p.title, body: p.blurb, bullets: p.bullets, chips: p.stack, link: p.link };
};

// Order matters: it is the order of the walk through the city.
export const stops: Stop[] = [
  {
    id: 'hello', nav: 'Hello',
    kicker: 'Toronto waterfront · sunrise',
    title: 'Good morning, Toronto.',
    body: "I'm Kulsum, a full-stack developer. Drag to look around my city, or click a building to visit it. Scroll to spend a day here: each building is a chapter of my career.",
    chips: ['React', 'TypeScript', 'NestJS', 'Firebase', 'GCP'],
  },
  {
    id: 'trueline', nav: 'Trueline',
    kicker: `${job.trueline.role} · ${job.trueline.dates} · ${job.trueline.place}`,
    title: 'Trueline Solution',
    body: 'Where I started shipping for real users.',
    bullets: job.trueline.bullets.slice(0, 4),
    chips: ['Web apps', 'Troubleshooting', 'Documentation'],
  },
  {
    id: 'seneca', nav: 'Education',
    kicker: 'Graduate Certificate, Business IT · 2025 – 2026',
    title: 'Seneca Polytechnic',
    body: 'GPA 3.8 / 4.0, after a BSc in Information Technology from Sarvajanik University (First Class with Distinction, CGPA 9.13).',
    bullets: education[0].notes,
    chips: ['GPA 3.8', 'CGPA 9.13', 'Linux', 'Cisco'],
  },
  {
    id: 'needlist', nav: 'Needlist',
    kicker: `${job.needlist.role} · ${job.needlist.dates} · Remote`,
    title: 'Needlist.org',
    body: 'Production full-stack work on a live platform.',
    bullets: [job.needlist.bullets[0], job.needlist.bullets[1], job.needlist.bullets[2], job.needlist.bullets[4]],
    chips: ['React', 'TypeScript', 'Node', 'Firestore', 'Jest'],
  },
  { ...projectStop('securevault', 'SecureVault'), kicker: 'Featured project · Security' },
  {
    id: 'lane', nav: 'Projects Lane',
    kicker: 'Just off Queens Quay',
    title: 'Welcome to Projects Lane.',
    body: 'Keep scrolling to walk down the lane. Every screen on these walls is something I built.',
    chips: ['5 projects', 'Cloud', 'ML', 'Mobile', 'Web'],
  },
  projectStop('ecs', 'AWS microservices'),
  projectStop('movies', 'Movie recommender'),
  projectStop('grocery', 'Grocery app'),
  projectStop('shop', 'E-commerce site'),
  projectStop('image', 'Image editor'),
  {
    id: 'contact', nav: 'Contact',
    kicker: 'Open to full-stack and developer roles',
    title: "Let's light up your team.",
    body: 'Available now for roles in Toronto or remote. I speak English, Hindi and Gujarati.',
    chips: ['Cisco Networking', 'IBM Cybersecurity', 'PMI Agile', 'Google AI'],
    contact: true,
  },
];
