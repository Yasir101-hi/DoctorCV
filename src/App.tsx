import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { FileText, Briefcase, Loader2, FileCode2, Building, MapPin, Sparkles, Upload, X, History, LayoutDashboard, ChevronRight, CheckCircle2, AlertCircle, Download, Copy, Trash2, Search, Settings, FileUser, Moon, Sun, Stethoscope, ChevronDown, ChevronUp, Eye, ClipboardCheck, Plus, Menu } from 'lucide-react';
import * as mammoth from 'mammoth';
import { ATSAnalysis } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default function App() {
  const [currentView, setCurrentView] = useState<'new' | 'history' | 'compare' | 'resumes' | 'cover-letters'>('new');
  const [step, setStep] = useState<'input' | 'analyzing' | 'results'>('input');
  
  // History Features State
  const [searchQuery, setSearchQuery] = useState('');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [expandedResumeId, setExpandedResumeId] = useState<string | null>(null);
  
  // Input State
  const [jobTitle, setJobTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [cvText, setCvText] = useState('');
  const [cvFile, setCvFile] = useState<File | null>(null);
  
  // Theme State
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Results State
  const [analysisResult, setAnalysisResult] = useState<ATSAnalysis | null>(null);
  const [history, setHistory] = useState<ATSAnalysis[]>([]);
  
  // Cover Letter State
  const [coverLetterStep, setCoverLetterStep] = useState<'idle' | 'generating' | 'done'>('idle');
  const [coverLetterInput, setCoverLetterInput] = useState({ jobTitle: '', companyName: '', location: '' });
  const [coverLetterResult, setCoverLetterResult] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedHistory = localStorage.getItem('atsHistory');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to parse history', e);
      }
    }

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleDarkMode = () => {
    setIsDarkMode(prev => {
      const newMode = !prev;
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newMode;
    });
  };

  const saveToHistory = (result: ATSAnalysis) => {
    const newHistory = [result, ...history];
    setHistory(newHistory);
    localStorage.setItem('atsHistory', JSON.stringify(newHistory));
  };

  const deleteFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = history.filter(item => item.id !== id);
    setHistory(newHistory);
    localStorage.setItem('atsHistory', JSON.stringify(newHistory));
    if (analysisResult?.id === id) {
      handleStartOver();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf') {
      setCvFile(file);
      setCvText('');
    } else if (file.name.endsWith('.docx') || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        setCvText(result.value);
        setCvFile(null);
      } catch (error) {
        console.error('Error extracting text from Word document:', error);
        alert('Failed to extract text from Word document. Please try pasting the text instead.');
      }
    } else if (file.type === 'text/plain') {
      const text = await file.text();
      setCvText(text);
      setCvFile(null);
    } else {
      alert('Unsupported file type. Please upload a PDF, DOCX, or TXT file.');
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAnalyze = async () => {
    if (!jobDescription || (!cvText && !cvFile) || !jobTitle || !companyName) return;
    setStep('analyzing');
    
    try {
      const promptText = `You are a professional ATS Resume Analyzer trained on modern recruitment systems used by international companies, as well as a LaTeX resume specialist.
Your job is to simulate how Applicant Tracking Systems evaluate resumes.
You must analyze the resume with high precision and generate a realistic ATS compatibility score.
Do NOT generate random scores. The ATS score must be calculated based on weighted evaluation criteria.

Job Title: ${jobTitle}
Company: ${companyName}

Here is the Job Description:
${jobDescription}

${cvFile ? "Here is the user's CV attached as a PDF document." : `Here is the user's CV:\n${cvText}`}

--------------------------------
ATS SCORING MODEL
Total score = 100
Evaluate the resume using the following weights:

1. Keyword Matching (30%)
Compare the resume with the Job Description. Check required skills, technical keywords, job titles, and tools/technologies. Calculate a keyword match percentage.

2. ATS Formatting Compatibility (20%)
Check if formatting is readable by ATS. Penalize for tables, icons, graphics, columns, images, unusual fonts. Reward simple formatting, clear headings, bullet points, chronological structure.

3. Skills Alignment (20%)
Evaluate whether skills in the resume match job requirements (hard skills, technical skills, tools, industry skills).

4. Achievements and Impact (15%)
Evaluate whether experience bullet points include measurable results, numbers, achievements, and action verbs (e.g., "Increased sales by 30% in 6 months").

5. Resume Structure & Clarity (15%)
Check for ATS-recognized sections (Summary, Experience, Skills, Education, Certifications). Evaluate readability and organization.

--------------------------------
DEEP ANALYSIS & KEYWORD GAP ANALYSIS
Provide Strengths, Weaknesses causing ATS rejection, Top 10 missing keywords from the job description, Formatting problems, and Suggestions for improvement.

--------------------------------
FINAL VERDICT
Classify the resume internally:
90-100: Excellent ATS Resume
75-89: Strong Resume
60-74: Needs Improvement
Below 60: High Risk of ATS Rejection

--------------------------------
IMPORTANT RULES
• Be strict and realistic
• Simulate real ATS behavior
• Avoid overly generous scores
• Explain scoring clearly

--------------------------------
OUTPUT REQUIREMENTS
You must return a detailed JSON response matching the required schema.
Include the calculated scores, the deep analysis report, a professionally rewritten CV in Markdown (optimized for the ATS), raw LaTeX code for Overleaf (using a clean ATS-friendly template), and Overleaf instructions.`;

      const parts: any[] = [{ text: promptText }];

      if (cvFile && cvFile.type === 'application/pdf') {
        const base64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
          };
          reader.readAsDataURL(cvFile);
        });
        
        parts.push({
          inlineData: {
            data: base64,
            mimeType: 'application/pdf'
          }
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              scores: {
                type: Type.OBJECT,
                properties: {
                  overall: { type: Type.INTEGER },
                  formatting: { type: Type.INTEGER },
                  keywords: { type: Type.INTEGER },
                  impact: { type: Type.INTEGER },
                  structure: { type: Type.INTEGER },
                  skills: { type: Type.INTEGER },
                },
                required: ["overall", "formatting", "keywords", "impact", "structure", "skills"]
              },
              report: {
                type: Type.OBJECT,
                properties: {
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
                  missingKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                  formattingProblems: { type: Type.ARRAY, items: { type: Type.STRING } },
                  improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ["strengths", "weaknesses", "missingKeywords", "formattingProblems", "improvements"]
              },
              rewrittenCV: { type: Type.STRING, description: "Markdown formatted rewritten CV" },
              latexCode: { type: Type.STRING, description: "Raw LaTeX code" },
              overleafInstructions: { type: Type.STRING }
            },
            required: ["scores", "report", "rewrittenCV", "latexCode", "overleafInstructions"]
          }
        }
      });

      const resultData = JSON.parse(response.text || '{}');
      
      const newAnalysis: ATSAnalysis = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        jobTitle,
        companyName,
        jobDescription,
        ...resultData
      };

      setAnalysisResult(newAnalysis);
      saveToHistory(newAnalysis);
      
      // Pre-fill cover letter inputs
      setCoverLetterInput({
        jobTitle,
        companyName,
        location: ''
      });
      
      setStep('results');
    } catch (error) {
      console.error('Error analyzing CV:', error);
      alert('Failed to analyze CV. Please try again.');
      setStep('input');
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!coverLetterInput.jobTitle || !coverLetterInput.companyName || !analysisResult) return;
    setCoverLetterStep('generating');
    
    try {
      const promptText = `You are an expert ATS Resume Reviewer, career consultant, and LaTeX resume specialist with 25 years of experience.

Based on the user's CV and the Job Description provided earlier, please generate a professional cover letter in LaTeX format.

Job Title: ${coverLetterInput.jobTitle}
Company Name: ${coverLetterInput.companyName}
Location: ${coverLetterInput.location}

Job Description:
${analysisResult.jobDescription}

User's Rewritten CV:
${analysisResult.rewrittenCV}

Provide the full LaTeX code for the cover letter in a markdown code block (\`\`\`latex ... \`\`\`). Also provide a plain text version of the cover letter.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: promptText,
      });

      const generatedText = response.text || '';
      setCoverLetterResult(generatedText);
      
      // Save cover letter to the current analysis result and history
      const updatedAnalysis = { ...analysisResult, coverLetter: generatedText };
      setAnalysisResult(updatedAnalysis);
      
      const newHistory = history.map(item => 
        item.id === analysisResult.id ? updatedAnalysis : item
      );
      setHistory(newHistory);
      localStorage.setItem('atsHistory', JSON.stringify(newHistory));
      
      setCoverLetterStep('done');
    } catch (error) {
      console.error('Error generating cover letter:', error);
      alert('Failed to generate cover letter. Please try again.');
      setCoverLetterStep('idle');
    }
  };

  const handleStartOver = () => {
    setStep('input');
    setAnalysisResult(null);
    setCoverLetterStep('idle');
    setCoverLetterResult('');
    setJobTitle('');
    setCompanyName('');
    setJobDescription('');
    setCvText('');
    setCvFile(null);
    setCurrentView('new');
  };

  const filteredHistory = history.filter(item => 
    item.jobTitle.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.companyName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredCoverLetters = filteredHistory.filter(item => item.coverLetter);

  const handleCardClick = (item: ATSAnalysis) => {
    if (compareMode) {
      if (selectedForCompare.includes(item.id)) {
        setSelectedForCompare(selectedForCompare.filter(id => id !== item.id));
      } else if (selectedForCompare.length < 2) {
        setSelectedForCompare([...selectedForCompare, item.id]);
      }
    } else {
      openHistoryItem(item);
    }
  };

  const openHistoryItem = (item: ATSAnalysis) => {
    setAnalysisResult(item);
    setStep('results');
    setCurrentView('new');
    setCoverLetterStep('idle');
    setCoverLetterResult('');
    setCoverLetterInput({
      jobTitle: item.jobTitle,
      companyName: item.companyName,
      location: ''
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const ScoreCircle = ({ score, label, size = 'lg' }: { score: number, label: string, size?: 'sm' | 'lg' }) => {
    const radius = size === 'lg' ? 60 : 30;
    const stroke = size === 'lg' ? 8 : 4;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (score / 100) * circumference;
    
    const colorClass = score >= 75 ? 'text-emerald-500' : score >= 60 ? 'text-amber-500' : 'text-rose-500';

    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative flex items-center justify-center">
          <svg height={radius * 2} width={radius * 2} className="transform -rotate-90">
            <circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              className="text-slate-100 dark:text-slate-800"
            />
            <motion.circle
              stroke="currentColor"
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset }}
              strokeLinecap="round"
              r={normalizedRadius}
              cx={radius}
              cy={radius}
              className={colorClass}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className={`font-bold ${size === 'lg' ? 'text-4xl' : 'text-xl'} text-slate-900 dark:text-white`}>{score}</span>
            {size === 'lg' && <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">Score</span>}
          </div>
        </div>
        <span className={`font-medium text-slate-700 dark:text-slate-300 ${size === 'lg' ? 'text-base' : 'text-sm'}`}>{label}</span>
      </div>
    );
  };

  const ProgressBar = ({ score, label }: { score: number, label: string }) => {
    const colorClass = score >= 75 ? 'bg-emerald-500' : score >= 60 ? 'bg-amber-500' : 'bg-rose-500';
    return (
      <div className="space-y-1.5">
        <div className="flex justify-between text-sm font-medium">
          <span className="text-slate-700 dark:text-slate-300">{label}</span>
          <span className="text-slate-900 dark:text-white">{score}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <motion.div 
            className={`h-full rounded-full ${colorClass}`}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-50 font-sans flex overflow-hidden">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col h-screen shrink-0 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between lg:justify-center border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3 drop-shadow-md">
            {/* Custom Logo Icon */}
            <div className="relative flex items-center justify-center w-14 h-14 shrink-0">
              {/* Document/Clipboard */}
              <div className="absolute inset-1 bg-white dark:bg-slate-800 rounded-lg shadow-md border-2 border-slate-200 dark:border-slate-600 flex flex-col items-center pt-1.5 z-10 transition-colors">
                <div className="w-4 h-4 text-green-500 mb-0.5">
                  <Plus className="w-full h-full" strokeWidth={4} />
                </div>
                <div className="w-6 h-0.5 bg-slate-200 dark:bg-slate-500 mb-1 rounded-full transition-colors"></div>
                <div className="w-6 h-0.5 bg-slate-200 dark:bg-slate-500 mb-1 rounded-full transition-colors"></div>
                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" strokeWidth={2.5} />
              </div>
              
              {/* Stethoscope Wrapping */}
              <Stethoscope className="w-16 h-16 text-blue-600 dark:text-blue-500 absolute -bottom-2 -left-2 z-20 drop-shadow-md" strokeWidth={1.5} />
              
              {/* Magnifying Glass with Plus */}
              <div className="absolute -bottom-1 -right-2 bg-white dark:bg-slate-900 rounded-full p-0.5 shadow-md border border-slate-200 dark:border-slate-700 z-30">
                <div className="bg-green-500 rounded-full p-1 flex items-center justify-center border-2 border-blue-600 dark:border-blue-500">
                  <Plus className="w-3 h-3 text-white" strokeWidth={4} />
                </div>
              </div>
            </div>
            
            {/* Logo Text */}
            <h1 className="flex flex-col leading-none">
              <span className="text-3xl font-black tracking-tighter text-blue-600 dark:text-blue-500 uppercase">CV</span>
              <span className="text-2xl font-bold tracking-tight text-green-500 dark:text-green-400 -mt-1">Doctor</span>
            </h1>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(false)}
            className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto">
          <button
            onClick={() => { setCurrentView('new'); if(step !== 'input') handleStartOver(); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentView === 'new' && step === 'input' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'}`}
          >
            <LayoutDashboard className="w-4 h-4" />
            New Analysis
          </button>
          <button
            onClick={() => { setCurrentView('resumes'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentView === 'resumes' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'}`}
          >
            <FileUser className="w-4 h-4" />
            My Resumes
          </button>
          <button
            onClick={() => { setCurrentView('cover-letters'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentView === 'cover-letters' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'}`}
          >
            <FileText className="w-4 h-4" />
            My Cover Letters
          </button>
          <button
            onClick={() => { setCurrentView('history'); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${currentView === 'history' || currentView === 'compare' ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200'}`}
          >
            <History className="w-4 h-4" />
            History & Saved
          </button>
        </nav>
        
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
          <button
            onClick={toggleDarkMode}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
          >
            {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {isDarkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
          <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700/50">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Pro Tip</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">Tailor your resume for each specific job description to maximize your ATS score.</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-screen overflow-y-auto relative flex flex-col">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30">
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-8 h-8 shrink-0">
              <div className="absolute inset-0.5 bg-white dark:bg-slate-800 rounded shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col items-center pt-0.5 z-10">
                <div className="w-2 h-2 text-green-500 mb-0.5">
                  <Plus className="w-full h-full" strokeWidth={4} />
                </div>
                <div className="w-3 h-px bg-slate-200 dark:bg-slate-500 mb-0.5 rounded-full"></div>
                <div className="w-3 h-px bg-slate-200 dark:bg-slate-500 mb-0.5 rounded-full"></div>
              </div>
              <Stethoscope className="w-10 h-10 text-blue-600 dark:text-blue-500 absolute -bottom-1 -left-1 z-20" strokeWidth={1.5} />
            </div>
            <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1">
              <span className="text-blue-600 dark:text-blue-500">CV</span>
              <span className="text-green-500 dark:text-green-400">Doctor</span>
            </span>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <AnimatePresence mode="wait">
          {currentView === 'compare' && selectedForCompare.length === 2 ? (
            <motion.div 
              key="compare"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Compare Analyses</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">See how your resume scores differ across job applications.</p>
                </div>
                <button 
                  onClick={() => setCurrentView('history')}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Back to History
                </button>
              </div>

              <div className="grid md:grid-cols-2 gap-8">
                {selectedForCompare.map(id => {
                  const item = history.find(h => h.id === id);
                  if (!item) return null;
                  return (
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
                      <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">{item.jobTitle}</h3>
                        <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                          <Building className="w-4 h-4" /> {item.companyName}
                        </p>
                      </div>
                      
                      <div className="flex flex-col items-center justify-center py-4">
                        <ScoreCircle score={item.scores.overall} label="Overall Score" size="lg" />
                      </div>
                      
                      <div className="space-y-4">
                        <ProgressBar score={item.scores.formatting} label="Formatting" />
                        <ProgressBar score={item.scores.keywords} label="Keywords" />
                        <ProgressBar score={item.scores.impact} label="Impact" />
                        <ProgressBar score={item.scores.structure} label="Structure" />
                        <ProgressBar score={item.scores.skills} label="Skills" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ) : currentView === 'history' ? (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Saved Analyses</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">Review your past resume optimizations and track your progress.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search jobs or companies..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all text-sm w-full sm:w-64 dark:text-white"
                    />
                  </div>
                  {history.length > 1 && (
                    <button
                      onClick={() => {
                        setCompareMode(!compareMode);
                        setSelectedForCompare([]);
                      }}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${compareMode ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
                    >
                      {compareMode ? 'Cancel Compare' : 'Compare'}
                    </button>
                  )}
                </div>
              </div>

              {compareMode && selectedForCompare.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 p-4 rounded-xl flex items-center justify-between"
                >
                  <span className="text-sm font-medium text-indigo-800 dark:text-indigo-300">
                    {selectedForCompare.length} selected for comparison (max 2)
                  </span>
                  <button
                    disabled={selectedForCompare.length !== 2}
                    onClick={() => setCurrentView('compare')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Compare Analyses
                  </button>
                </motion.div>
              )}

              {filteredHistory.length === 0 ? (
                <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                  <History className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                    {history.length === 0 ? 'No history yet' : 'No matches found'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {history.length === 0 ? 'Your saved analyses will appear here.' : 'Try adjusting your search query.'}
                  </p>
                  {history.length === 0 && (
                    <button 
                      onClick={() => setCurrentView('new')}
                      className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-colors"
                    >
                      Start an Analysis
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredHistory.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => handleCardClick(item)}
                      className={`bg-white dark:bg-slate-900 p-6 rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group relative ${
                        compareMode && selectedForCompare.includes(item.id) 
                          ? 'border-indigo-500 ring-2 ring-indigo-200 dark:ring-indigo-900' 
                          : 'border-slate-200 dark:border-slate-800 hover:border-indigo-200 dark:hover:border-indigo-800'
                      }`}
                    >
                      {!compareMode && (
                        <button 
                          onClick={(e) => deleteFromHistory(item.id, e)}
                          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {compareMode && (
                        <div className="absolute top-4 right-4">
                          <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                            selectedForCompare.includes(item.id) 
                              ? 'bg-indigo-600 border-indigo-600 text-white' 
                              : 'border-slate-300 dark:border-slate-600'
                          }`}>
                            {selectedForCompare.includes(item.id) && <CheckCircle2 className="w-3 h-3" />}
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-slate-900 dark:text-white truncate pr-8">{item.jobTitle}</h3>
                          <p className="text-sm text-slate-500 dark:text-slate-400 truncate">{item.companyName}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${item.scores.overall >= 75 ? 'bg-emerald-500' : item.scores.overall >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}></div>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Score: {item.scores.overall}</span>
                        </div>
                        <span className="text-xs text-slate-400">{new Date(item.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : currentView === 'resumes' ? (
            <motion.div 
              key="resumes"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">My Resumes</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">Access your optimized resumes categorized by job title.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search job titles..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all text-sm w-full sm:w-64 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {filteredHistory.length === 0 ? (
                <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                  <FileUser className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                    {history.length === 0 ? 'No resumes yet' : 'No matches found'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {history.length === 0 ? 'Your optimized resumes will appear here.' : 'Try adjusting your search query.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredHistory.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${expandedResumeId === item.id ? 'mb-6 border-b border-slate-100 dark:border-slate-800 pb-4' : ''}`}>
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{item.jobTitle}</h3>
                            <div className={`px-2.5 py-0.5 rounded-full text-xs font-semibold flex items-center gap-1 ${item.scores.overall >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : item.scores.overall >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                              <Sparkles className="w-3 h-3" />
                              Score: {item.scores.overall}
                            </div>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1.5">
                            <Building className="w-4 h-4" /> {item.companyName}
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span>{new Date(item.date).toLocaleDateString()}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setExpandedResumeId(expandedResumeId === item.id ? null : item.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          >
                            {expandedResumeId === item.id ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {expandedResumeId === item.id ? 'Hide' : 'View'}
                          </button>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(item.rewrittenCV);
                              alert('Resume copied to clipboard!');
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              const blob = new Blob([item.rewrittenCV], { type: 'text/plain' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `Resume_${item.jobTitle.replace(/\s+/g, '_')}.txt`;
                              a.click();
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {expandedResumeId === item.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="prose prose-slate dark:prose-invert max-w-none prose-sm bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-100 dark:border-slate-800 mt-2">
                              <ReactMarkdown>{item.rewrittenCV}</ReactMarkdown>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : currentView === 'cover-letters' ? (
            <motion.div 
              key="cover-letters"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto space-y-8"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">My Cover Letters</h2>
                  <p className="text-slate-500 dark:text-slate-400 mt-2">Access your generated cover letters categorized by job title.</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="Search job titles..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all text-sm w-full sm:w-64 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {filteredCoverLetters.length === 0 ? (
                <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed">
                  <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-900 dark:text-white">
                    {history.filter(i => i.coverLetter).length === 0 ? 'No cover letters yet' : 'No matches found'}
                  </h3>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">
                    {history.filter(i => i.coverLetter).length === 0 ? 'Your generated cover letters will appear here.' : 'Try adjusting your search query.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredCoverLetters.map((item) => (
                    <div key={item.id} className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all hover:shadow-md">
                      <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 ${expandedResumeId === item.id ? 'mb-6 border-b border-slate-100 dark:border-slate-800 pb-4' : ''}`}>
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{item.jobTitle}</h3>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1.5">
                            <Building className="w-4 h-4" /> {item.companyName}
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <span>{new Date(item.date).toLocaleDateString()}</span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => setExpandedResumeId(expandedResumeId === item.id ? null : item.id)}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                          >
                            {expandedResumeId === item.id ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            {expandedResumeId === item.id ? 'Hide' : 'View'}
                          </button>
                          <button
                            onClick={() => {
                              if (item.coverLetter) {
                                navigator.clipboard.writeText(item.coverLetter);
                                alert('Cover letter copied to clipboard!');
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                            Copy
                          </button>
                          <button
                            onClick={() => {
                              if (item.coverLetter) {
                                const blob = new Blob([item.coverLetter], { type: 'text/plain' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `Cover_Letter_${item.jobTitle.replace(/\s+/g, '_')}.txt`;
                                a.click();
                              }
                            }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            Download
                          </button>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {expandedResumeId === item.id && item.coverLetter && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="prose prose-slate dark:prose-invert max-w-none prose-sm bg-slate-50 dark:bg-slate-950 p-6 rounded-xl border border-slate-100 dark:border-slate-800 mt-2">
                              <ReactMarkdown>{item.coverLetter}</ReactMarkdown>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="new"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="p-4 sm:p-6 md:p-10 max-w-7xl mx-auto"
            >
              {step === 'input' && (
                <div className="space-y-8 max-w-5xl mx-auto">
                  <div className="text-center space-y-6 mb-12">
                    <h2 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900 dark:text-white">
                      Land Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-green-500">Dream Job</span> Faster
                    </h2>
                    <div className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                      <p>Transform your resume into an ATS-beating masterpiece in seconds.</p>
                      <div className="flex flex-wrap justify-center items-center gap-3 mt-5 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <span className="flex items-center gap-1.5 bg-blue-50 dark:bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-500/20 shadow-sm"><Sparkles className="w-4 h-4 text-blue-500" /> Instant ATS Scoring</span>
                        <span className="flex items-center gap-1.5 bg-green-50 dark:bg-green-500/10 px-3 py-1.5 rounded-full border border-green-100 dark:border-green-500/20 shadow-sm"><FileText className="w-4 h-4 text-green-500" /> Smart AI Rewriting</span>
                        <span className="flex items-center gap-1.5 bg-purple-50 dark:bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-100 dark:border-purple-500/20 shadow-sm"><FileCode2 className="w-4 h-4 text-purple-500" /> Pro LaTeX Templates</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-8">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          <Briefcase className="w-4 h-4 text-indigo-500" />
                          Target Job Title
                        </label>
                        <input
                          type="text"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          placeholder="e.g. Senior Frontend Developer"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all text-sm dark:text-white"
                        />
                      </div>
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          <Building className="w-4 h-4 text-indigo-500" />
                          Company Name
                        </label>
                        <input
                          type="text"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          placeholder="e.g. Google"
                          className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all text-sm dark:text-white"
                        />
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 pt-4 border-t border-slate-100 dark:border-slate-800">
                      <div className="space-y-3">
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                          <FileText className="w-4 h-4 text-indigo-500" />
                          Job Description
                        </label>
                        <textarea
                          value={jobDescription}
                          onChange={(e) => setJobDescription(e.target.value)}
                          placeholder="Paste the full job description here..."
                          className="w-full h-80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all resize-none text-sm dark:text-white"
                        />
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                            <FileText className="w-4 h-4 text-indigo-500" />
                            Your Current CV
                          </label>
                        </div>
                        
                        {cvFile ? (
                          <div className="w-full h-80 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center gap-4 relative overflow-hidden group">
                            <div className="absolute inset-0 bg-indigo-50/80 dark:bg-slate-900/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                              <button 
                                onClick={() => setCvFile(null)}
                                className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/30 font-medium rounded-lg shadow-sm border border-rose-100 dark:border-rose-900/50 transition-colors"
                              >
                                <X className="w-4 h-4" />
                                Remove File
                              </button>
                            </div>
                            <div className="bg-white dark:bg-slate-800 p-4 rounded-full shadow-sm">
                              <FileText className="w-12 h-12 text-indigo-500" />
                            </div>
                            <div className="text-center max-w-[80%]">
                              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{cvFile.name}</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Ready for analysis</p>
                            </div>
                          </div>
                        ) : (
                          <div className="relative">
                            <textarea
                              value={cvText}
                              onChange={(e) => setCvText(e.target.value)}
                              placeholder="Paste your current CV text here, or upload a file..."
                              className="w-full h-80 p-4 pb-16 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all resize-none text-sm dark:text-white"
                            />
                            <div className="absolute bottom-4 right-4">
                              <label className="cursor-pointer flex items-center gap-2 text-sm font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2.5 rounded-xl transition-colors border border-indigo-100 dark:border-indigo-500/20 shadow-sm backdrop-blur-sm">
                                <Upload className="w-4 h-4" />
                                Upload PDF / Word
                                <input 
                                  type="file" 
                                  accept=".pdf,.docx,.txt" 
                                  className="hidden" 
                                  onChange={handleFileUpload}
                                  ref={fileInputRef}
                                />
                              </label>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      onClick={handleAnalyze}
                      disabled={!jobDescription || (!cvText && !cvFile) || !jobTitle || !companyName}
                      className="inline-flex items-center gap-2 px-10 py-4 bg-indigo-600 text-white text-lg font-semibold rounded-full hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                    >
                      <Sparkles className="w-5 h-5" />
                      Analyze & Optimize Resume
                    </button>
                  </div>
                </div>
              )}

              {step === 'analyzing' && (
                <div className="flex flex-col items-center justify-center h-[70vh] space-y-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-indigo-200 dark:bg-indigo-900/50 rounded-full blur-2xl animate-pulse opacity-50"></div>
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-full shadow-xl relative z-10">
                      <Loader2 className="w-12 h-12 text-indigo-600 dark:text-indigo-400 animate-spin" />
                    </div>
                  </div>
                  <div className="text-center space-y-3">
                    <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Analyzing your Resume</h3>
                    <div className="flex flex-col gap-2 text-slate-500 dark:text-slate-400 font-medium">
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>Parsing ATS keywords...</motion.p>
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}>Evaluating impact metrics...</motion.p>
                      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 4 }}>Drafting LaTeX structure...</motion.p>
                    </div>
                  </div>
                </div>
              )}

              {step === 'results' && analysisResult && (
                <div className="space-y-8 pb-24">
                  {/* Header */}
                  <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{analysisResult.jobTitle}</h2>
                      <p className="text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-1">
                        <Building className="w-4 h-4" /> {analysisResult.companyName}
                      </p>
                    </div>
                    <button 
                      onClick={handleStartOver}
                      className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors"
                    >
                      New Analysis
                    </button>
                  </div>

                  {/* Dashboard Tier 1: Scores */}
                  <div className="grid lg:grid-cols-3 gap-8">
                    <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col items-center justify-center text-center">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">Overall ATS Match</h3>
                      <ScoreCircle score={analysisResult.scores.overall} label="ATS Score" size="lg" />
                      <p className="mt-6 text-sm font-medium text-slate-600 dark:text-slate-300">
                        {analysisResult.scores.overall >= 90 ? 'Excellent ATS Resume' : 
                         analysisResult.scores.overall >= 75 ? 'Strong Resume' : 
                         analysisResult.scores.overall >= 60 ? 'Needs Improvement' : 
                         'High Risk of ATS Rejection'}
                      </p>
                    </div>

                    <div className="lg:col-span-2 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800">
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-6">Score Breakdown</h3>
                      <div className="grid sm:grid-cols-2 gap-x-12 gap-y-6">
                        <ProgressBar score={analysisResult.scores.formatting} label="Formatting & Parsing" />
                        <ProgressBar score={analysisResult.scores.keywords} label="Keyword Match" />
                        <ProgressBar score={analysisResult.scores.impact} label="Impact & Metrics" />
                        <ProgressBar score={analysisResult.scores.structure} label="Structure & Flow" />
                        <ProgressBar score={analysisResult.scores.skills} label="Skills Alignment" />
                      </div>
                    </div>
                  </div>

                  {/* Dashboard Tier 2: Gap Analysis */}
                  <div className="grid lg:grid-cols-2 gap-8">
                    <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-4">
                        <CheckCircle2 className="w-5 h-5" />
                        <h3 className="text-lg font-semibold dark:text-white">Strengths</h3>
                      </div>
                      <ul className="space-y-3">
                        {analysisResult.report.strengths.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0"></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-6">
                      <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 mb-4">
                        <AlertCircle className="w-5 h-5" />
                        <h3 className="text-lg font-semibold dark:text-white">Critical Weaknesses</h3>
                      </div>
                      <ul className="space-y-3">
                        {analysisResult.report.weaknesses.map((item, i) => (
                          <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mt-1.5 shrink-0"></span>
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Missing Keywords & Improvements */}
                  <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 space-y-8">
                    <div>
                      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Missing Keywords to Add</h3>
                      <div className="flex flex-wrap gap-2">
                        {analysisResult.report.missingKeywords.map((keyword, i) => (
                          <span key={i} className="px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-lg text-sm font-medium border border-indigo-100 dark:border-indigo-500/20">
                            {keyword}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 pt-8 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Formatting Issues</h3>
                        <ul className="space-y-3">
                          {analysisResult.report.formattingProblems.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-1.5 shrink-0"></span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-4">Actionable Improvements</h3>
                        <ul className="space-y-3">
                          {analysisResult.report.improvements.map((item, i) => (
                            <li key={i} className="flex items-start gap-3 text-slate-700 dark:text-slate-300 text-sm">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0"></span>
                              {item}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* Rewritten CV & LaTeX */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">Optimized Resume & LaTeX</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ready to copy into Overleaf</p>
                      </div>
                      <div className="flex gap-3">
                        <button 
                          onClick={() => copyToClipboard(analysisResult.rewrittenCV)}
                          className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                        >
                          <Copy className="w-4 h-4" /> Copy Text
                        </button>
                        <button 
                          onClick={() => copyToClipboard(analysisResult.latexCode)}
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                          <FileCode2 className="w-4 h-4" /> Copy LaTeX
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
                      <div className="p-6 sm:p-8 prose prose-slate dark:prose-invert prose-sm max-w-none">
                        <h4 className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-xs font-bold mb-4">Markdown Preview</h4>
                        <ReactMarkdown>{analysisResult.rewrittenCV}</ReactMarkdown>
                      </div>
                      <div className="p-6 sm:p-8 bg-slate-900 dark:bg-slate-950 overflow-x-auto">
                        <h4 className="text-slate-400 dark:text-slate-500 uppercase tracking-wider text-xs font-bold mb-4">LaTeX Source</h4>
                        <pre className="text-slate-300 dark:text-slate-400 text-xs font-mono leading-relaxed">
                          <code>{analysisResult.latexCode}</code>
                        </pre>
                      </div>
                    </div>
                    
                    <div className="p-6 bg-indigo-50 dark:bg-indigo-500/10 border-t border-indigo-100 dark:border-indigo-500/20">
                      <h4 className="font-semibold text-indigo-900 dark:text-indigo-300 mb-2">Overleaf Instructions</h4>
                      <p className="text-sm text-indigo-800 dark:text-indigo-200/80">{analysisResult.overleafInstructions}</p>
                    </div>
                  </div>

                  {/* Cover Letter Generator */}
                  <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 p-8">
                    <div className="space-y-2 mb-8">
                      <h3 className="text-2xl font-bold text-slate-900 dark:text-white">Generate Cover Letter</h3>
                      <p className="text-slate-500 dark:text-slate-400">
                        Create a tailored, ATS-friendly cover letter in LaTeX format based on your optimized resume.
                      </p>
                    </div>

                    {coverLetterStep === 'idle' && (
                      <div className="grid sm:grid-cols-3 gap-6">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Job Title</label>
                          <input
                            type="text"
                            value={coverLetterInput.jobTitle}
                            onChange={(e) => setCoverLetterInput({ ...coverLetterInput, jobTitle: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all text-sm dark:text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Company Name</label>
                          <input
                            type="text"
                            value={coverLetterInput.companyName}
                            onChange={(e) => setCoverLetterInput({ ...coverLetterInput, companyName: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all text-sm dark:text-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">Location (Optional)</label>
                          <input
                            type="text"
                            value={coverLetterInput.location}
                            onChange={(e) => setCoverLetterInput({ ...coverLetterInput, location: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 focus:bg-white dark:focus:bg-slate-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-900 transition-all text-sm dark:text-white"
                          />
                        </div>
                        <div className="sm:col-span-3 pt-2">
                          <button
                            onClick={handleGenerateCoverLetter}
                            disabled={!coverLetterInput.jobTitle || !coverLetterInput.companyName}
                            className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:ring-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                          >
                            <FileCode2 className="w-4 h-4" />
                            Generate Cover Letter
                          </button>
                        </div>
                      </div>
                    )}

                    {coverLetterStep === 'generating' && (
                      <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400 py-8 justify-center">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="font-medium text-lg">Drafting your cover letter...</span>
                      </div>
                    )}

                    {coverLetterStep === 'done' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 space-y-4"
                      >
                        <div className="flex justify-end">
                          <button 
                            onClick={() => copyToClipboard(coverLetterResult)}
                            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
                          >
                            <Copy className="w-4 h-4" /> Copy Content
                          </button>
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-950 rounded-2xl p-8 border border-slate-200 dark:border-slate-800 prose prose-slate dark:prose-invert prose-indigo max-w-none prose-pre:bg-slate-900 prose-pre:text-slate-50">
                          <ReactMarkdown>{coverLetterResult}</ReactMarkdown>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
