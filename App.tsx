
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { 
  Plus, Search, Trash2, ArrowRight, MinusSquare, CheckSquare, 
  Play, Filter, Layers, BrainCircuit, RotateCcw, X, ChevronDown, ChevronRight,
  Save, FolderOpen, MoreHorizontal, Download, Sparkles, Loader2, List, AlertTriangle,
  SortAsc, SortDesc, Upload, FileText, ClipboardList, Scissors, Undo2, FolderPlus, Check,
  FolderTree, ChevronDownSquare, ChevronRightSquare, Hash, BarChart2, FolderLock, FileSearch, Tag
} from 'lucide-react';
import { Keyword, Project, Group, KeywordStatus, NegativeGroup } from './types';
import { fetchSynonymsAndSuggestions, expandKeywords, smartFilterKeywords, estimateFrequenciesForList, KeywordEstimate } from './geminiService';

const STORAGE_KEY = 'keyword_pro_projects_v3';
const DEFAULT_GROUP_NAME = "Общая";
const TRASH_GROUP_NAME = "Корзина";
const DEFAULT_NEGATIVE_GROUP_NAME = "Общие";

const App: React.FC = () => {
  // State
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [themeInput, setThemeInput] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [columnSearchQuery, setColumnSearchQuery] = useState('');
  
  // Group Tree state
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');

  // Negative Groups state
  const [activeNegativeGroupId, setActiveNegativeGroupId] = useState<string | null>(null);
  const [editingNegGroupId, setEditingNegGroupId] = useState<string | null>(null);
  const [editingNegGroupName, setEditingNegGroupName] = useState('');

  // UI state
  const [isMoveDropdownOpen, setIsMoveDropdownOpen] = useState(false);
  const moveDropdownRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [showNegatives, setShowNegatives] = useState(false);
  const [showSelected, setShowSelected] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showProjectManager, setShowProjectManager] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  
  // New Project/Group state
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  
  // Analysis state
  const [expandedWords, setExpandedWords] = useState<Set<string>>(new Set());
  const [selectedWordsForNegative, setSelectedWordsForNegative] = useState<Set<string>>(new Set());
  
  // Bulk add state
  const [bulkInput, setBulkInput] = useState('');

  // Derived state
  const currentProject = useMemo(() => 
    projects.find(p => p.id === currentProjectId) || null
  , [projects, currentProjectId]);

  const trashGroup = useMemo(() => 
    currentProject?.groups.find(g => g.name === TRASH_GROUP_NAME) || null
  , [currentProject]);

  const mainGroup = useMemo(() => 
    currentProject?.groups.find(g => g.name === DEFAULT_GROUP_NAME) || null
  , [currentProject]);

  // Ensure project has at least one negative group and set it active
  useEffect(() => {
    if (currentProject && currentProject.negativeGroups.length === 0) {
      const firstNegGroupId = Math.random().toString(36).substr(2, 9);
      updateProject(p => ({
        ...p,
        negativeGroups: [{ id: firstNegGroupId, name: DEFAULT_NEGATIVE_GROUP_NAME }]
      }));
      setActiveNegativeGroupId(firstNegGroupId);
    } else if (currentProject && !activeNegativeGroupId) {
      setActiveNegativeGroupId(currentProject.negativeGroups[0].id);
    }
  }, [currentProject]);

  // Memoized set of words that are marked as negative in the project
  const negativeWordsSet = useMemo(() => {
    if (!currentProject) return new Set<string>();
    const set = new Set<string>();
    currentProject.keywords.forEach(k => {
      if (k.isNegative) {
        set.add(k.text.toLowerCase().trim());
      }
    });
    return set;
  }, [currentProject?.keywords]);

  // Set default selection to "Общая" if nothing is selected
  useEffect(() => {
    if (currentProject && !selectedGroupId) {
      if (mainGroup) setSelectedGroupId(mainGroup.id);
    }
  }, [currentProject, selectedGroupId, mainGroup]);

  useEffect(() => {
    if (currentProject) {
      setThemeInput(currentProject.theme || '');
    } else {
      setThemeInput('');
    }
    setSelection(new Set());
  }, [currentProjectId]);

  // Handle click outside for Move Dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moveDropdownRef.current && !moveDropdownRef.current.contains(event.target as Node)) {
        setIsMoveDropdownOpen(false);
      }
    };
    if (isMoveDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoveDropdownOpen]);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setProjects(parsed);
        if (parsed.length > 0 && !currentProjectId) setCurrentProjectId(parsed[0].id);
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    }
  }, []);

  useEffect(() => {
    if (projects.length >= 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    }
  }, [projects]);

  // Actions
  const handleCreateProject = () => {
    const trimmedName = newProjectName.trim();
    if (!trimmedName) return;

    const newId = Math.random().toString(36).substr(2, 9);
    const defaultGroupId = Math.random().toString(36).substr(2, 9);
    const trashGroupId = Math.random().toString(36).substr(2, 9);
    const defaultNegGroupId = Math.random().toString(36).substr(2, 9);
    
    const newProject: Project = {
      id: newId,
      name: trimmedName,
      theme: '',
      keywords: [],
      groups: [
        { id: defaultGroupId, name: DEFAULT_GROUP_NAME },
        { id: trashGroupId, name: TRASH_GROUP_NAME }
      ],
      negativeGroups: [
        { id: defaultNegGroupId, name: DEFAULT_NEGATIVE_GROUP_NAME }
      ],
      createdAt: Date.now(),
    };
    
    setProjects(prev => [...prev, newProject]);
    setCurrentProjectId(newId);
    setSelectedGroupId(defaultGroupId);
    setActiveNegativeGroupId(defaultNegGroupId);
    setNewProjectName('');
    setIsCreatingProject(false);
    setShowProjectManager(false);
  };

  const updateProject = (updater: (p: Project) => Project) => {
    if (!currentProjectId) return;
    setProjects(prev => prev.map(p => p.id === currentProjectId ? updater(p) : p));
  };

  const handleThemeChange = (val: string) => {
    setThemeInput(val);
    updateProject(p => ({ ...p, theme: val }));
  };

  const handleCreateGroup = (parentId?: string) => {
    const name = "Новая группа";
    const newGroupId = Math.random().toString(36).substr(2, 9);
    const newGroup: Group = { 
      id: newGroupId, 
      name,
      parentId
    };
    updateProject(p => ({ ...p, groups: [...p.groups, newGroup] }));
    
    setTimeout(() => {
      setEditingGroupId(newGroupId);
      setEditingGroupName(name);
      setSelectedGroupId(newGroupId);
    }, 50);

    if (parentId) {
      const next = new Set(expandedGroups);
      next.add(parentId);
      setExpandedGroups(next);
    }
  };

  const handleCreateNegativeGroup = () => {
    const name = "Новая категория";
    const newId = Math.random().toString(36).substr(2, 9);
    updateProject(p => ({
      ...p,
      negativeGroups: [...p.negativeGroups, { id: newId, name }]
    }));
    setActiveNegativeGroupId(newId);
    setEditingNegGroupId(newId);
    setEditingNegGroupName(name);
  };

  const saveNegGroupRename = () => {
    if (!editingNegGroupId) return;
    updateProject(p => ({
      ...p,
      negativeGroups: p.negativeGroups.map(g => g.id === editingNegGroupId ? { ...g, name: editingNegGroupName.trim() || "Без имени" } : g)
    }));
    setEditingNegGroupId(null);
  };

  const startRenameGroup = (group: Group) => {
    if (group.name === TRASH_GROUP_NAME || group.name === DEFAULT_GROUP_NAME) return;
    setEditingGroupId(group.id);
    setEditingGroupName(group.name);
  };

  const saveGroupRename = () => {
    if (!editingGroupId) return;
    const finalName = editingGroupName.trim() || "Без названия";
    updateProject(p => ({
      ...p,
      groups: p.groups.map(g => g.id === editingGroupId ? { ...g, name: finalName } : g)
    }));
    setEditingGroupId(null);
  };

  const addKeywordsToProject = (items: (string | KeywordEstimate)[], status: KeywordStatus = 'parsed') => {
    if (!currentProject) return 0;

    const existingTexts = new Set(currentProject.keywords.map(k => k.text.trim().toLowerCase()));
    const uniqueNewKeywords: Keyword[] = [];
    
    const targetGroupId = selectedGroupId === trashGroup?.id 
      ? mainGroup?.id 
      : (selectedGroupId || mainGroup?.id);

    items.forEach(item => {
      const text = typeof item === 'string' ? item.trim() : item.text.trim();
      if (text && !existingTexts.has(text.toLowerCase())) {
        const freq = typeof item === 'object' ? item.frequency : Math.floor(Math.random() * 500) + 10;
        const exactFreq = typeof item === 'object' ? item.exactFrequency : Math.floor(Math.random() * freq);
        
        uniqueNewKeywords.push({
          id: Math.random().toString(36).substr(2, 9),
          text: text,
          status: status,
          groupId: targetGroupId,
          frequency: freq,
          exactFrequency: exactFreq
        });
        existingTexts.add(text.toLowerCase());
      }
    });

    if (uniqueNewKeywords.length > 0) {
      updateProject(p => ({
        ...p,
        keywords: [...p.keywords, ...uniqueNewKeywords]
      }));
    }
    return uniqueNewKeywords.length;
  };

  const triggerSuggestions = async () => {
    const input = themeInput.trim();
    if (!input) {
      alert("Введите тематику бизнеса");
      return;
    }
    
    if (!currentProjectId) {
      setShowProjectManager(true);
      setIsCreatingProject(true);
      return;
    }

    setLoading(true);
    try {
      const suggestions = await fetchSynonymsAndSuggestions(input);
      addKeywordsToProject(suggestions, 'preliminary');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAddAction = async () => {
    const lines = bulkInput.split(/[\n,;]/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    
    const addedCount = addKeywordsToProject(lines);
    alert(`Добавлено новых фраз: ${addedCount}.`);
    
    setBulkInput('');
    setShowBulkAdd(false);
  };

  const handleEstimateFrequencies = async () => {
    if (selection.size === 0 || !currentProject) return;
    
    const selectedKeywords = currentProject.keywords.filter(k => selection.has(k.id));
    const texts = selectedKeywords.map(k => k.text);
    
    setLoading(true);
    try {
      const estimates = await estimateFrequenciesForList(texts, currentProject.theme);
      if (estimates.length > 0) {
        updateProject(p => ({
          ...p,
          keywords: p.keywords.map(k => {
            const est = estimates.find(e => e.text.toLowerCase().trim() === k.text.toLowerCase().trim());
            if (est) {
              return { ...k, frequency: est.frequency, exactFrequency: est.exactFrequency };
            }
            return k;
          })
        }));
        alert(`Оценка частотности обновлена для ${estimates.length} фраз.`);
      } else {
        alert("Не удалось получить оценку частотности. Попробуйте позже.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selection);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelection(next);
  };

  const moveKeywords = (status: KeywordStatus, keepSelection: boolean = false) => {
    if (selection.size === 0) return;
    
    updateProject(p => {
      const targetTrashGroup = p.groups.find(g => g.name === TRASH_GROUP_NAME);
      const targetMainGroup = p.groups.find(g => g.name === DEFAULT_GROUP_NAME);
      return {
        ...p,
        keywords: p.keywords.map(k => {
          if (selection.has(k.id)) {
            let nextStatus = k.status;
            let nextGroupId = k.groupId;
            let nextIsNegative = k.isNegative;

            if (status === 'trash' && targetTrashGroup) {
              nextStatus = 'trash';
              nextGroupId = targetTrashGroup.id;
            } else if (status === 'parsed') {
              nextStatus = 'parsed';
              // If moving from preliminary, it goes to Общая
              if (k.status === 'preliminary' || k.groupId === targetTrashGroup?.id) {
                nextGroupId = targetMainGroup?.id;
              }
            }
            return { ...k, status: nextStatus, groupId: nextGroupId, isNegative: nextIsNegative };
          }
          return k;
        })
      };
    });
    if (!keepSelection) {
      setSelection(new Set());
    }
  };

  const handleNegativeWordsFromAnalysis = () => {
    if (selectedWordsForNegative.size === 0) return;
    
    const wordsToMinus: string[] = [...selectedWordsForNegative];
    
    updateProject(p => {
        // Find existing negatives specifically in the CURRENT project
        const existingNegatives = new Set(p.keywords.filter(k => k.isNegative).map(k => k.text.toLowerCase().trim()));
        
        const uniqueWordsToMinus = wordsToMinus.filter(word => !existingNegatives.has(word.toLowerCase().trim()));

        const targetNegGroupId = activeNegativeGroupId || (p.negativeGroups.length > 0 ? p.negativeGroups[0].id : null);

        const newNegativeKeywords: Keyword[] = uniqueWordsToMinus.map((word: string) => ({
            id: Math.random().toString(36).substr(2, 9),
            text: word,
            status: 'parsed',
            isNegative: true,
            negativeGroupId: targetNegGroupId || undefined,
            groupId: undefined,
            frequency: 0,
            exactFrequency: 0
        }));

        return {
            ...p,
            keywords: [...p.keywords, ...newNegativeKeywords]
        };
    });

    setSelectedWordsForNegative(new Set());
    setSelection(new Set());
    setShowAnalysis(false);
    alert(`Слова добавлены в список минус-слов.`);
  };

  const deleteKeywordsPermanently = () => {
    if (selection.size === 0) return;
    if (!confirm(`Вы действительно хотите безвозвратно удалить ${selection.size} фраз?`)) return;
    updateProject(p => ({
      ...p,
      keywords: p.keywords.filter(k => !selection.has(k.id))
    }));
    setSelection(new Set());
  };

  const moveToGroup = (groupId: string) => {
    if (selection.size === 0) return;
    const isTrashGroup = groupId === trashGroup?.id;
    updateProject(p => ({
      ...p,
      keywords: p.keywords.map(k => selection.has(k.id) ? { 
        ...k, 
        groupId, 
        status: isTrashGroup ? 'trash' : 'parsed' 
      } : k)
    }));
    setSelection(new Set());
    setIsMoveDropdownOpen(false);
  };

  const startAnalysis = async () => {
    if (!currentProject) return;
    const seeds = currentProject.keywords
      .filter(k => k.status === 'selected' && selection.has(k.id))
      .map(k => k.text);
    if (seeds.length === 0) return;

    setLoading(true);
    try {
      const expanded = await expandKeywords(seeds, currentProject.theme);
      addKeywordsToProject(expanded, 'parsed');
      setShowSelected(false);
      setSelection(new Set());
    } finally {
      setLoading(false);
    }
  };

  const filteredKeywords = useCallback((status: KeywordStatus) => {
    if (!currentProject) return [];
    
    const searchLower = searchQuery.toLowerCase();
    const columnSearchLower = columnSearchQuery.toLowerCase();

    if (status === 'parsed') {
      const base = selectedGroupId === trashGroup?.id 
        ? currentProject.keywords.filter(k => !k.isNegative && k.groupId === trashGroup?.id)
        : currentProject.keywords.filter(k => !k.isNegative && k.status === 'parsed' && k.groupId === selectedGroupId);

      return base.filter(k => 
        k.text.toLowerCase().includes(searchLower) && 
        k.text.toLowerCase().includes(columnSearchLower)
      );
    }

    if (status === 'negative') {
        return currentProject.keywords.filter(k => 
            k.isNegative && 
            k.negativeGroupId === activeNegativeGroupId &&
            k.text.toLowerCase().includes(searchLower)
        );
    }

    return currentProject.keywords.filter(k => 
      !k.isNegative &&
      k.status === status &&
      k.text.toLowerCase().includes(searchLower)
    );
  }, [currentProject, searchQuery, columnSearchQuery, selectedGroupId, trashGroup, activeNegativeGroupId]);

  const runSmartFilter = async () => {
    if (!currentProject) return;
    const parsedKeywords = filteredKeywords('parsed');
    if (parsedKeywords.length === 0) return;

    setLoading(true);
    try {
      const indices = await smartFilterKeywords(parsedKeywords.map(k => k.text), currentProject.theme);
      if (indices && indices.length > 0) {
        const idsToMark = indices.map(idx => parsedKeywords[idx]?.id).filter(Boolean);
        updateProject(p => ({
          ...p,
          keywords: p.keywords.map(k => idsToMark.includes(k.id) ? { ...k, aiSuggestedNegative: true } : k)
        }));
        alert(`Найдено потенциально мусорных запросов: ${idsToMark.length}. Они отмечены.`);
      } else {
        alert("Мусорных запросов не обнаружено.");
      }
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupExpand = (id: string) => {
    const next = new Set(expandedGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedGroups(next);
  };

  const wordAnalysisMap = useMemo((): [string, string[]][] => {
    const map: Record<string, string[]> = {};
    const parsed = filteredKeywords('parsed');
    parsed.forEach((k: Keyword) => {
      const words = k.text.toLowerCase().split(/[^a-zа-я0-9]/).filter(w => w.length > 1);
      Array.from(new Set(words)).forEach((w: string) => {
        if (!map[w]) map[w] = [];
        map[w].push(k.id);
      });
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [currentProject?.keywords, searchQuery, filteredKeywords]);

  const toggleWordSelectionGroup = (word: string, ids: string[]) => {
    const nextWords = new Set(selectedWordsForNegative);
    const nextSelection = new Set(selection);
    
    if (nextWords.has(word)) {
        nextWords.delete(word);
        ids.forEach(id => nextSelection.delete(id));
    } else {
        nextWords.add(word);
        ids.forEach(id => nextSelection.add(id));
    }
    
    setSelectedWordsForNegative(nextWords);
    setSelection(nextSelection);
  };

  const toggleWordExpand = (word: string) => {
    const next = new Set(expandedWords);
    if (next.has(word)) next.delete(word);
    else next.add(word);
    setExpandedWords(next);
  };

  const renderGroupTree = (parentId?: string, depth = 0) => {
    if (!currentProject) return null;
    const children = currentProject.groups.filter(g => g.parentId === parentId && g.name !== TRASH_GROUP_NAME);
    if (children.length === 0 && parentId) return null;

    return (
      <div className={`flex flex-col ${depth > 0 ? 'ml-3 border-l border-slate-100' : ''}`}>
        {children.map(group => {
          const isExpanded = expandedGroups.has(group.id);
          const isSelected = selectedGroupId === group.id;
          const isEditing = editingGroupId === group.id;
          const hasChildren = currentProject.groups.some(g => g.parentId === group.id && g.name !== TRASH_GROUP_NAME);
          const count = currentProject.keywords.filter(k => k.groupId === group.id && !k.isNegative).length;

          return (
            <div key={group.id} className="flex flex-col">
              <div 
                className={`group flex items-center p-1.5 rounded-lg cursor-pointer transition-all ${isSelected && !isEditing ? 'bg-blue-50 text-blue-700 shadow-sm' : 'hover:bg-slate-50 text-slate-600'}`}
                onClick={() => {
                  if (isSelected && !isEditing) {
                    startRenameGroup(group);
                  } else {
                    setSelectedGroupId(group.id);
                  }
                }}
              >
                <div 
                  className="p-1 hover:bg-slate-200/50 rounded transition-colors"
                  onClick={(e) => { e.stopPropagation(); toggleGroupExpand(group.id); }}
                >
                  {hasChildren ? (
                    isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />
                  ) : (
                    <div className="w-3.5" />
                  )}
                </div>
                <Hash size={12} className={`mr-2 ${isSelected ? 'text-blue-500' : 'text-gray-300'}`} />
                
                {isEditing ? (
                  <input 
                    autoFocus
                    className="flex-1 bg-white border border-blue-400 rounded px-1.5 py-0.5 text-xs font-bold outline-none shadow-inner"
                    value={editingGroupName}
                    onChange={(e) => setEditingGroupName(e.target.value)}
                    onBlur={saveGroupRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') saveGroupRename();
                      if (e.key === 'Escape') setEditingGroupId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className={`text-xs flex-1 truncate ${isSelected ? 'font-black' : 'font-medium'}`}>{group.name}</span>
                )}
                
                <span className="text-[9px] bg-white border border-slate-100 px-1.5 py-0.5 rounded font-black opacity-60 ml-2">{count}</span>
                
                {!isEditing && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleCreateGroup(group.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-blue-500 transition-opacity ml-1 bg-white/50 rounded shadow-sm border border-slate-100"
                    title="Создать подгруппу"
                  >
                    <Plus size={12} />
                  </button>
                )}
              </div>
              {isExpanded && renderGroupTree(group.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden text-slate-800">
      <header className="h-16 bg-slate-900 text-white flex items-center justify-between px-6 shadow-md z-30">
        <div className="flex items-center gap-4">
          <Layers className="text-blue-400" size={28} />
          <h1 className="text-xl font-black tracking-tight italic">KeywordPro <span className="text-blue-400 not-italic">AI</span></h1>
          <div className="h-6 w-px bg-slate-700 mx-2" />
          <button 
            onClick={() => { setShowProjectManager(true); setIsCreatingProject(false); }}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg hover:bg-slate-700 transition-all text-xs font-bold shadow-inner"
          >
            <FolderOpen size={16} />
            {currentProject ? currentProject.name : 'Выбрать проект'}
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          {loading && (
            <div className="flex items-center gap-2 text-[10px] text-blue-300 animate-pulse font-black uppercase tracking-widest">
              <Loader2 className="animate-spin" size={14} /> AI Processing
            </div>
          )}
          <button 
             onClick={() => setShowAnalysis(true)}
             className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs font-black flex items-center gap-2 transition-all shadow-xl shadow-blue-900/20 uppercase tracking-wider"
          >
            <Search size={16} /> Анализ слов
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden bg-white">
        <div className="w-64 bg-slate-50 border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 space-y-3 bg-white">
            <div className="flex justify-between items-center">
              <h2 className="font-black text-slate-400 uppercase text-[9px] tracking-[0.2em]">Подбор</h2>
              <button onClick={() => setShowNegatives(true)} className="text-[9px] text-red-500 hover:text-red-700 flex items-center gap-1 font-black uppercase tracking-widest transition-colors">
                <MinusSquare size={12} /> Минус-слова
              </button>
            </div>
            <div className="flex gap-1.5">
              <input 
                type="text" 
                placeholder="Тематика..."
                value={themeInput}
                onChange={(e) => handleThemeChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && triggerSuggestions()}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              />
              <button onClick={triggerSuggestions} disabled={loading || !themeInput.trim()} className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 shadow-lg shadow-blue-200/50 transition-all">
                {loading ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
              </button>
            </div>
            {/* Seeds button removed per user request */}
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
            {filteredKeywords('preliminary').map(k => (
              <div key={k.id} className="flex items-center p-2 rounded-lg hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-100 transition-all group">
                <input type="checkbox" checked={selection.has(k.id)} onChange={() => toggleSelect(k.id)} className="mr-3 h-3.5 w-3.5 rounded-md border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-[11px] text-slate-600 flex-1 truncate font-medium group-hover:text-slate-900">{k.text}</span>
              </div>
            ))}
          </div>
          {selection.size > 0 && Array.from(selection).some(id => currentProject?.keywords.find(k => k.id === id)?.status === 'preliminary') && (
            <div className="p-3 bg-white border-t border-slate-200 animate-in slide-in-from-bottom-2 flex gap-2">
              <button 
                onClick={() => moveKeywords('parsed')} 
                className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-blue-700 shadow-lg shadow-blue-100"
              >
                Добавить
              </button>
              <button 
                onClick={() => moveKeywords('trash')} 
                className="flex-1 py-2 bg-slate-200 text-slate-500 rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-300"
              >
                В корзину
              </button>
            </div>
          )}
        </div>

        <div className="w-72 bg-white border-r border-slate-200 flex flex-col shadow-sm z-10">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <FolderTree size={16} className="text-slate-400" />
              <h2 className="font-black text-slate-400 uppercase text-[9px] tracking-[0.2em]">Дерево групп</h2>
            </div>
            <button 
              onClick={() => handleCreateGroup()} 
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors border border-slate-200 shadow-sm"
              title="Создать группу верхнего уровня"
            >
              <FolderPlus size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 custom-scrollbar flex flex-col">
            {currentProject ? (
              <>
                <div className="flex-1">
                  {renderGroupTree()}
                </div>
                {trashGroup && (
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div 
                      className={`group flex items-center p-2 rounded-lg cursor-pointer transition-all ${selectedGroupId === trashGroup.id ? 'bg-red-50 text-red-700 shadow-sm' : 'hover:bg-slate-50 text-slate-500'}`}
                      onClick={() => setSelectedGroupId(trashGroup.id)}
                    >
                      <Trash2 size={14} className={`mr-2 ${selectedGroupId === trashGroup.id ? 'text-red-500' : 'text-gray-300'}`} />
                      <span className={`text-xs flex-1 truncate ${selectedGroupId === trashGroup.id ? 'font-black' : 'font-medium'}`}>{trashGroup.name}</span>
                      <span className="text-[9px] bg-white border border-slate-100 px-1.5 py-0.5 rounded font-black opacity-60 ml-2">
                        {currentProject.keywords.filter(k => k.groupId === trashGroup.id && !k.isNegative).length}
                      </span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-2 grayscale opacity-50">
                <Hash size={32} />
                <span className="text-[10px] font-bold uppercase tracking-widest">Нет проекта</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-slate-50/30">
          <div className="p-4 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <button onClick={runSmartFilter} className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-indigo-100 hover:bg-indigo-500 transition-all">Умный отбор</button>
              <button onClick={() => { setBulkInput(''); setShowBulkAdd(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-100 hover:bg-blue-500 transition-all">Добавить список</button>
              <div className="h-4 w-px bg-slate-200 mx-2" />
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Поиск по фразам..." 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  className="w-64 pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white transition-all" 
                />
                <Search className="absolute left-3.5 top-2.5 text-slate-400" size={14} />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            {currentProject ? (
              <div className="space-y-6 max-w-6xl mx-auto">
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in duration-500">
                  <div className={`px-5 py-3.5 ${selectedGroupId === trashGroup?.id ? 'bg-red-50/50' : 'bg-slate-50/50'} text-[10px] font-black uppercase tracking-[0.2em] border-b border-slate-100 flex justify-between items-center`}>
                    <div className="flex items-center gap-2">
                      {selectedGroupId === trashGroup?.id ? <Trash2 size={14} className="text-red-500" /> : <Hash size={14} className="text-blue-500" />}
                      <span>{currentProject.groups.find(g => g.id === selectedGroupId)?.name || 'Все слова'}</span>
                    </div>
                    <span className="text-slate-400">{filteredKeywords('parsed').length} фраз</span>
                  </div>
                  
                  {/* Table Header with local filter */}
                  <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex items-center text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <div className="w-10"></div>
                    <div className="flex-1 flex items-center gap-4">
                      <span>Фраза</span>
                      <div className="relative max-w-xs flex-1">
                        <Search className="absolute left-2 top-1.5 text-slate-300" size={10} />
                        <input 
                          type="text"
                          placeholder="Фильтр по части слова..."
                          value={columnSearchQuery}
                          onChange={(e) => setColumnSearchQuery(e.target.value)}
                          className="w-full pl-6 pr-2 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-bold outline-none focus:ring-1 focus:ring-blue-400 transition-all placeholder:text-slate-300"
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right pr-4">Частотность</div>
                    <div className="w-24 text-right">Точная</div>
                  </div>

                  <div className="flex flex-col">
                    {filteredKeywords('parsed').length === 0 ? (
                      <div className="py-12 text-center text-slate-300 italic text-xs font-medium">Ничего не найдено</div>
                    ) : (
                      filteredKeywords('parsed').map(k => {
                        const words = k.text.toLowerCase().split(/[^a-zа-я0-9]/).filter(w => w.length > 0);
                        const hasNegativeWord = words.some(w => negativeWordsSet.has(w));

                        return (
                          <label key={k.id} className={`flex items-center px-6 py-3 border-b border-slate-50 last:border-0 transition-all cursor-pointer group ${selection.has(k.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}>
                            <input type="checkbox" checked={selection.has(k.id)} onChange={() => toggleSelect(k.id)} className="h-4 w-4 rounded-md text-blue-600 border-slate-300 focus:ring-blue-500" />
                            <div className="flex-1 ml-4 truncate">
                              <span className={`text-[11px] font-bold ${
                                  hasNegativeWord ? 'text-red-500' :
                                  k.aiSuggestedNegative ? 'text-orange-400 line-through opacity-60' : 
                                  'text-slate-700 group-hover:text-slate-900'
                                }`}>
                                {k.text}
                              </span>
                            </div>
                            <div className="w-24 text-right pr-4 text-[10px] font-black text-slate-400 font-mono">
                              {k.frequency?.toLocaleString() || '-'}
                            </div>
                            <div className="w-24 text-right text-[10px] font-black text-blue-400 font-mono">
                              {k.exactFrequency?.toLocaleString() || '-'}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-300 space-y-6">
                 <FolderOpen size={80} strokeWidth={1} />
                 <div className="text-center space-y-2">
                   <p className="text-sm font-black uppercase tracking-[0.2em]">Добро пожаловать</p>
                   <p className="text-[10px] font-medium max-w-xs leading-relaxed">Выберите существующий проект или создайте новый, чтобы начать сбор семантики</p>
                 </div>
                 <button 
                  onClick={() => { setShowProjectManager(true); setIsCreatingProject(true); }}
                  className="px-8 py-3 bg-blue-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 hover:-translate-y-1 transition-all active:translate-y-0"
                >
                   + Новый проект
                 </button>
              </div>
            )}
          </div>

          {/* Sticky Actions */}
          {selection.size > 0 && Array.from(selection).some(id => {
            const k = currentProject?.keywords.find(item => item.id === id);
            return k?.status === 'parsed' || k?.status === 'trash';
          }) && (
             <div className="sticky bottom-8 mx-auto mb-8 px-6 py-4 bg-slate-900 text-white rounded-2xl shadow-2xl flex items-center gap-6 z-40 animate-in slide-in-from-bottom-10">
                <div className="flex flex-col border-r border-slate-700 pr-6">
                  <span className="text-[8px] text-slate-400 font-black uppercase tracking-widest">Выбрано</span>
                  <span className="text-xl font-black text-blue-400 leading-none">{selection.size}</span>
                </div>
                
                <div className="flex gap-2">
                  {selectedGroupId === trashGroup?.id ? (
                    <>
                      <button onClick={() => moveKeywords('parsed')} className="px-5 py-2.5 bg-green-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-green-700 transition-all shadow-lg shadow-green-900/20">Восстановить</button>
                      <button onClick={deleteKeywordsPermanently} className="px-5 py-2.5 bg-slate-800 text-red-400 border border-red-900/50 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-black transition-all">Удалить</button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => moveKeywords('trash')} className="px-5 py-2.5 bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-600 transition-all">В корзину</button>
                      <button 
                        onClick={handleEstimateFrequencies}
                        disabled={loading}
                        className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-indigo-500 transition-all flex items-center gap-2 shadow-lg shadow-indigo-900/20"
                      >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : <BarChart2 size={14} />}
                        Оценить частотность
                      </button>
                    </>
                  )}
                  
                  <div className="relative" ref={moveDropdownRef}>
                    <button 
                      onClick={() => setIsMoveDropdownOpen(!isMoveDropdownOpen)}
                      className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-blue-500 transition-all flex items-center gap-2 shadow-lg shadow-blue-900/20"
                    >
                      Перенести <ChevronDown size={14} className={`transition-transform duration-200 ${isMoveDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isMoveDropdownOpen && (
                      <div className="absolute bottom-full mb-3 left-0 w-64 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-3 max-h-64 overflow-y-auto custom-scrollbar animate-in zoom-in-95 origin-bottom-left">
                        <p className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-2 px-2">Выберите целевую группу</p>
                        {currentProject?.groups.filter(g => g.name !== TRASH_GROUP_NAME).map(g => (
                          <button key={g.id} onClick={() => moveToGroup(g.id)} className="w-full text-left p-2.5 text-[10px] font-bold text-slate-300 hover:bg-slate-700 rounded-xl transition-all flex items-center gap-2">
                             <Hash size={12} className="text-slate-500" />
                            {g.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <button onClick={() => setSelection(new Set())} className="p-2 text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
             </div>
          )}
        </div>
      </main>

      {/* Negative Keywords Modal */}
      {showNegatives && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-4xl h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-red-50/20 shrink-0">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-red-600 text-white rounded-2xl shadow-xl shadow-red-100"><MinusSquare size={24} /></div>
                   <div>
                      <h2 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">Библиотека Минусов</h2>
                      <p className="text-[10px] text-red-400 uppercase font-black tracking-[0.2em]">Управление категориями и словами</p>
                   </div>
                </div>
                <button onClick={() => { setShowNegatives(false); setSelection(new Set()); }} className="p-2 hover:bg-red-50 text-red-500 rounded-full transition-colors"><X size={28} /></button>
             </div>
             
             <div className="flex-1 flex overflow-hidden">
                {/* Negative Groups Sidebar */}
                <div className="w-64 bg-slate-50 border-r border-slate-100 flex flex-col p-4 space-y-4">
                   <div className="flex justify-between items-center px-2">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Категории</span>
                      <button onClick={handleCreateNegativeGroup} className="p-1 hover:bg-red-100 rounded text-red-600 transition-all"><FolderPlus size={14} /></button>
                   </div>
                   <div className="flex-1 overflow-y-auto space-y-1 custom-scrollbar">
                      {currentProject?.negativeGroups.map(ng => {
                        const isSelected = activeNegativeGroupId === ng.id;
                        const isEditing = editingNegGroupId === ng.id;
                        const count = currentProject.keywords.filter(k => k.isNegative && k.negativeGroupId === ng.id).length;
                        
                        return (
                          <div 
                            key={ng.id}
                            onClick={() => {
                              if (isSelected && !isEditing) {
                                setEditingNegGroupId(ng.id);
                                setEditingNegGroupName(ng.name);
                              } else {
                                setActiveNegativeGroupId(ng.id);
                              }
                            }}
                            className={`group flex items-center gap-2 p-2.5 rounded-xl cursor-pointer transition-all ${isSelected ? 'bg-red-600 text-white shadow-lg shadow-red-200' : 'hover:bg-white text-slate-600'}`}
                          >
                             <FolderLock size={14} className={isSelected ? 'text-red-200' : 'text-slate-300'} />
                             {isEditing ? (
                               <input 
                                  autoFocus
                                  className="flex-1 bg-white text-slate-900 px-1 py-0.5 rounded text-[10px] font-bold outline-none"
                                  value={editingNegGroupName}
                                  onChange={e => setEditingNegGroupName(e.target.value)}
                                  onBlur={saveNegGroupRename}
                                  onKeyDown={e => e.key === 'Enter' && saveNegGroupRename()}
                                  onClick={e => e.stopPropagation()}
                               />
                             ) : (
                               <span className="text-[11px] font-bold flex-1 truncate">{ng.name}</span>
                             )}
                             <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg ${isSelected ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-500'}`}>{count}</span>
                          </div>
                        )
                      })}
                   </div>
                </div>

                {/* Negative Words Main Area */}
                <div className="flex-1 flex flex-col bg-white">
                   <div className="p-4 border-b border-slate-50 flex items-center justify-between bg-slate-50/30">
                      <div className="flex items-center gap-2">
                        <Tag size={14} className="text-red-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                          {currentProject?.negativeGroups.find(ng => ng.id === activeNegativeGroupId)?.name || 'Выберите группу'}
                        </span>
                      </div>
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">{filteredKeywords('negative').length} слов в списке</span>
                   </div>

                   <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                      {filteredKeywords('negative').length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-200 space-y-3 grayscale">
                           <FileSearch size={48} strokeWidth={1} />
                           <p className="text-[10px] font-black uppercase tracking-[0.2em]">В этой группе пока пусто</p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1"> {/* Vertical column with small gap */}
                          {filteredKeywords('negative').map(k => (
                            <label key={k.id} className={`flex items-center p-2 rounded-lg border transition-all cursor-pointer ${selection.has(k.id) ? 'bg-red-50 border-red-200 shadow-inner' : 'bg-white border-slate-100 hover:border-slate-200'}`}>
                              <input type="checkbox" checked={selection.has(k.id)} onChange={() => toggleSelect(k.id)} className="mr-3 h-3.5 w-3.5 text-red-600 rounded-md border-slate-300 focus:ring-red-500" />
                              <span className="text-[11px] font-bold text-slate-700 truncate">{k.text}</span>
                            </label>
                          ))}
                        </div>
                      )}
                   </div>
                </div>
             </div>

             <div className="p-8 bg-white border-t border-slate-100 flex items-center justify-between gap-6 shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest leading-tight">Выбрано</span>
                  <span className="text-2xl font-black text-red-600 leading-none">{selection.size}</span>
                </div>
                <div className="flex gap-3">
                  <button 
                    disabled={selection.size === 0}
                    onClick={() => {
                        updateProject(p => ({
                            ...p,
                            keywords: p.keywords.map(k => selection.has(k.id) ? { ...k, isNegative: false, negativeGroupId: undefined } : k)
                        }));
                        setSelection(new Set());
                    }} 
                    className="flex items-center gap-2 px-8 py-3.5 bg-green-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-green-100 hover:bg-green-700 transition-all disabled:opacity-30 disabled:shadow-none"
                  >
                    <Undo2 size={16} /> Убрать из списка
                  </button>
                  <button 
                    disabled={selection.size === 0}
                    onClick={() => {
                        if (confirm(`Безвозвратно удалить ${selection.size} слов из этой группы?`)) {
                          updateProject(p => ({
                            ...p,
                            keywords: p.keywords.filter(k => !selection.has(k.id))
                          }));
                          setSelection(new Set());
                        }
                    }} 
                    className="flex items-center gap-2 px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-100 hover:bg-black transition-all disabled:opacity-30"
                  >
                    <Trash2 size={16} /> Удалить
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Word Analysis Modal */}
      {showAnalysis && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl h-[80vh] shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-indigo-50/30 shrink-0">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100"><Scissors size={24} /></div>
                   <div>
                      <h2 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">Анализ по словам</h2>
                      <p className="text-[10px] text-indigo-400 uppercase font-black tracking-[0.2em]">Разбивка фраз на леммы</p>
                   </div>
                </div>
                <button onClick={() => { setShowAnalysis(false); setSelection(new Set()); setSelectedWordsForNegative(new Set()); }} className="p-2 hover:bg-indigo-50 text-indigo-500 rounded-full transition-colors"><X size={28} /></button>
             </div>
             
             <div className="flex-1 overflow-y-auto bg-white custom-scrollbar divide-y divide-slate-100">
                {wordAnalysisMap.map(([word, ids]) => {
                  const isExpanded = expandedWords.has(word);
                  const isWordSelected = selectedWordsForNegative.has(word);
                  
                  return (
                    <div key={word} className="transition-all overflow-hidden bg-white">
                      <div className="flex items-center py-0.5 px-3 hover:bg-slate-50 transition-colors">
                        <input 
                          type="checkbox" 
                          checked={isWordSelected}
                          onChange={() => toggleWordSelectionGroup(word, ids)}
                          className="mr-2 h-4 w-4 rounded-md border-slate-300 text-indigo-600 cursor-pointer"
                        />
                        <div className="flex-1 flex items-center gap-2 cursor-pointer py-0.5" onClick={() => toggleWordExpand(word)}>
                          <span className="text-[11px] font-bold text-slate-700 capitalize tracking-tight">{word}</span>
                          <span className="text-[9px] text-slate-400 font-medium tracking-tighter italic">({ids.length} вх.)</span>
                        </div>
                        {isExpanded ? <ChevronDown size={14} className="text-slate-300 ml-auto" /> : <ChevronRight size={14} className="text-slate-300 ml-auto" />}
                      </div>
                      
                      {isExpanded && (
                        <div className="px-10 py-1 bg-slate-50 border-t border-slate-100 space-y-1">
                          {ids.map(id => {
                            const k = currentProject?.keywords.find(item => item.id === id);
                            if (!k) return null;
                            const isSelected = selection.has(k.id);
                            return (
                              <label key={id} className="flex items-center py-1 border-b border-white last:border-0 cursor-pointer group">
                                <input 
                                  type="checkbox" 
                                  checked={isSelected}
                                  onChange={() => toggleSelect(k.id)}
                                  className="mr-2 h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className={`text-[10px] font-medium truncate transition-colors ${isSelected ? 'text-indigo-600 font-bold' : 'text-slate-600 group-hover:text-slate-900'}`}>
                                  {k.text}
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
             </div>

             <div className="p-8 bg-white border-t border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex flex-col min-w-[200px]">
                  <span className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Будут добавлены в группу:</span>
                  <div className="relative group/select">
                    <select 
                      value={activeNegativeGroupId || ''} 
                      onChange={(e) => setActiveNegativeGroupId(e.target.value)}
                      className="appearance-none w-full bg-red-50 border border-red-100 text-red-600 text-[11px] font-black uppercase py-2 pl-3 pr-8 rounded-xl cursor-pointer outline-none hover:bg-red-100 transition-all"
                    >
                      {currentProject?.negativeGroups.map(ng => (
                        <option key={ng.id} value={ng.id}>{ng.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-2.5 text-red-400 pointer-events-none group-hover/select:translate-y-0.5 transition-transform" />
                  </div>
                  <span className="text-2xl font-black text-red-600 leading-none mt-2">{selectedWordsForNegative.size} слов</span>
                </div>
                <div className="flex gap-3">
                  <button 
                    disabled={selectedWordsForNegative.size === 0}
                    onClick={handleNegativeWordsFromAnalysis} 
                    className="px-8 py-3.5 bg-red-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-red-100 hover:bg-red-700 transition-all disabled:opacity-30"
                  >
                    В минус
                  </button>
                  <button 
                    disabled={selection.size === 0}
                    onClick={() => { moveKeywords('trash'); setShowAnalysis(false); }} 
                    className="px-8 py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-slate-100 hover:bg-black transition-all disabled:opacity-30"
                  >
                    В корзину
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Bulk Add Modal */}
      {showBulkAdd && (
        <div className="fixed inset-0 bg-slate-900/60 z-[80] flex items-center justify-center p-4">
           <div className="bg-white rounded-3xl w-full max-w-md p-8 flex flex-col shadow-2xl animate-in zoom-in-95">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100"><Upload size={20} /></div>
                <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Массовая загрузка</h2>
              </div>
              <textarea 
                value={bulkInput} 
                onChange={(e) => setBulkInput(e.target.value)} 
                placeholder="Вставьте слова по одному на строку..." 
                className="w-full h-64 p-4 border border-slate-200 rounded-2xl text-xs font-medium mb-6 outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono bg-slate-50/50" 
              />
              <div className="flex gap-3">
                <button 
                    disabled={loading || !bulkInput.trim()}
                    onClick={handleBulkAddAction} 
                    className="flex-1 py-3.5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-100 hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                    {loading ? <Loader2 className="animate-spin inline mr-2" size={16} /> : null}
                    Загрузить
                </button>
                <button onClick={() => setShowBulkAdd(false)} className="px-6 py-3.5 bg-white border border-slate-200 text-slate-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all">Отмена</button>
              </div>
           </div>
        </div>
      )}

      {/* Project Manager Modal */}
      {showProjectManager && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Ваши проекты</h2>
              <button onClick={() => setShowProjectManager(false)} className="p-1 hover:bg-slate-200 rounded-full transition-colors"><X size={20}/></button>
            </div>
            
            <div className="p-4 max-h-[50vh] overflow-y-auto space-y-2 bg-white custom-scrollbar">
              {projects.length === 0 ? (
                <div className="py-12 text-center flex flex-col items-center gap-4">
                  <FolderOpen size={48} className="text-slate-100" />
                  <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Проектов пока нет</p>
                </div>
              ) : (
                projects.map(p => (
                  <div 
                    key={p.id} 
                    onClick={() => { setCurrentProjectId(p.id); setShowProjectManager(false); }} 
                    className={`group p-4 rounded-2xl text-xs font-black cursor-pointer transition-all flex justify-between items-center ${currentProjectId === p.id ? 'bg-blue-600 text-white shadow-xl shadow-blue-100' : 'hover:bg-slate-50 border border-slate-50 text-slate-600'}`}
                  >
                    <div className="flex-1 truncate">
                      <span>{p.name}</span>
                      <span className={`text-[9px] opacity-60 ml-2 ${currentProjectId === p.id ? 'text-white' : 'text-blue-500'}`}>({p.keywords.length})</span>
                    </div>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm("Удалить проект?")) {
                          setProjects(prev => prev.filter(proj => proj.id !== p.id));
                          if (currentProjectId === p.id) setCurrentProjectId(null);
                        }
                      }}
                      className={`opacity-0 group-hover:opacity-100 p-2 rounded-xl transition-all ${currentProjectId === p.id ? 'hover:bg-blue-700 text-white' : 'hover:bg-red-50 text-red-400'}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50/30">
              {isCreatingProject ? (
                <div className="space-y-4 animate-in slide-in-from-bottom-2">
                  <input 
                    autoFocus
                    type="text" 
                    placeholder="Название проекта..."
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
                    className="w-full px-4 py-3 bg-white border border-blue-200 rounded-2xl text-xs font-bold outline-none shadow-inner"
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={handleCreateProject}
                      disabled={!newProjectName.trim()}
                      className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-200 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-blue-200 transition-all"
                    >
                      Создать
                    </button>
                    <button 
                      onClick={() => setIsCreatingProject(false)}
                      className="px-6 py-3 bg-white border border-slate-200 text-slate-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <button 
                  onClick={() => setIsCreatingProject(true)} 
                  className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-blue-200 transition-all flex items-center justify-center gap-3"
                >
                  <Plus size={18} /> Создать проект
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Seeds Modal (Keeping just in case, though its trigger is removed from main UI) */}
      {showSelected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg h-[75vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-blue-50/20 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-100"><Sparkles size={24} /></div>
                <div>
                   <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Семантические семена</h2>
                   <p className="text-[10px] text-blue-400 uppercase font-black tracking-widest">База для расширения ядра</p>
                </div>
              </div>
              <button onClick={() => { setShowSelected(false); setSelection(new Set()); }} className="p-2 hover:bg-blue-50 text-blue-600 rounded-full transition-colors"><X size={28} /></button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/20 custom-scrollbar">
                 {currentProject?.keywords.filter(k => k.status === 'selected').length === 0 ? (
                   <div className="py-24 text-center text-slate-300 font-black text-[10px] uppercase tracking-[0.2em]">Список пуст</div>
                 ) : (
                   <div className="grid grid-cols-1 gap-2">
                     {currentProject?.keywords.filter(k => k.status === 'selected').map(k => (
                       <label key={k.id} className="flex items-center p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-300 hover:shadow-sm cursor-pointer transition-all group">
                         <input type="checkbox" checked={selection.has(k.id)} onChange={() => toggleSelect(k.id)} className="h-5 w-5 mr-4 text-blue-600 rounded-md border-slate-300" />
                         <span className="text-xs font-black text-slate-700 group-hover:text-blue-600">{k.text}</span>
                       </label>
                     ))}
                   </div>
                 )}
            </div>
            
            <div className="p-8 border-t border-slate-100 bg-white shrink-0">
               <button 
                  onClick={startAnalysis} 
                  disabled={loading || selection.size === 0} 
                  className="w-full py-4 bg-green-600 text-white rounded-[1.5rem] font-black text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-2xl shadow-green-200 hover:bg-green-700 transition-all disabled:opacity-30 disabled:shadow-none"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
                  Запустить расширение ({selection.size})
               </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

export default App;
