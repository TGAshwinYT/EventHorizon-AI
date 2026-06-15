import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Option {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (value: string) => void;
    options: string[] | Option[];
    label?: string;
    placeholder?: string;
    disabled?: boolean;
    accentColor?: string; // 'purple', 'emerald', 'blue', etc.
}

const CustomSelect = memo(({ 
    value, 
    onChange, 
    options, 
    label, 
    placeholder = 'Select option', 
    disabled = false,
    accentColor = 'emerald'
}: CustomSelectProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUp: false });

    const updateCoords = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            const spaceBelow = window.innerHeight - rect.bottom;
            const menuHeight = 300; // max-h-[300px]
            const openUp = spaceBelow < menuHeight && rect.top > menuHeight;
            
            setCoords({
                top: openUp ? rect.top : rect.bottom,
                left: rect.left,
                width: rect.width,
                openUp
            });
        }
    };

    // Close when clicking outside (must check both trigger container AND portal dropdown)
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const target = event.target as Node;
            const insideTrigger = containerRef.current?.contains(target);
            const insideDropdown = dropdownRef.current?.contains(target);
            if (!insideTrigger && !insideDropdown) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('touchstart', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, []);

    // Prevent body scroll and update position when open
    useEffect(() => {
        if (isOpen) {
            updateCoords();
            const originalStyle = window.getComputedStyle(document.body).overflow;
            document.body.style.overflow = 'hidden';
            
            window.addEventListener('scroll', updateCoords, true);
            window.addEventListener('resize', updateCoords);
            
            return () => {
                document.body.style.overflow = originalStyle;
                window.removeEventListener('scroll', updateCoords, true);
                window.removeEventListener('resize', updateCoords);
            };
        }
    }, [isOpen]);

    const getAccentClasses = () => {
        const themes: Record<string, string> = {
            emerald: isOpen ? 'border-emerald-500 ring-1 ring-emerald-500/20' : 'hover:border-white/20',
            purple: isOpen ? 'border-purple-500 ring-1 ring-purple-500/20' : 'hover:border-white/20',
            blue: isOpen ? 'border-blue-500 ring-1 ring-blue-500/20' : 'hover:border-white/20',
            green: isOpen ? 'border-green-500 ring-1 ring-green-500/20' : 'hover:border-white/20',
        };
        return themes[accentColor] || themes.emerald;
    };

    const getOptionClasses = (optionValue: string) => {
        const isSelected = value === optionValue;
        if (!isSelected) return 'text-gray-300 hover:bg-white/5';
        
        const themes: Record<string, string> = {
            emerald: 'bg-emerald-500/10 text-emerald-400',
            purple: 'bg-purple-500/10 text-purple-400',
            blue: 'bg-blue-500/10 text-blue-400',
            green: 'bg-green-500/10 text-green-400',
        };
        return themes[accentColor] || themes.emerald;
    };

    const getCheckIconColor = () => {
        const themes: Record<string, string> = {
            emerald: 'text-emerald-400',
            purple: 'text-purple-400',
            blue: 'text-blue-400',
            green: 'text-green-400',
        };
        return themes[accentColor] || themes.emerald;
    };

    return (
        <div className="relative w-full" ref={containerRef}>
            {label && <label className="block text-xs text-gray-400 mb-1 ml-1">{label}</label>}
            
            <button
                ref={triggerRef}
                type="button"
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                className={`w-full min-w-[160px] bg-black/40 backdrop-blur-md border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between transition-all outline-none
                    ${getAccentClasses()}
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
            >
                <span className={`text-sm ${value ? 'text-white' : 'text-gray-500'}`}>
                    {options.length > 0 ? (
                        typeof options[0] === 'string' 
                            ? value || placeholder
                            : (options as Option[]).find(o => o.value === value)?.label || placeholder
                    ) : placeholder}
                </span>
                <ChevronDown 
                    className={`w-4 h-4 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
                />
            </button>

            {createPortal(
                <AnimatePresence>
                    {isOpen && (
                        <>
                            {/* Transparent backdrop — closes dropdown on click, blocks background scroll */}
                            <div 
                                className="fixed inset-0 z-[9998] cursor-default"
                                onClick={() => setIsOpen(false)}
                                onContextMenu={(e) => e.preventDefault()}
                                onWheel={(e) => {
                                    e.preventDefault();
                                }}
                                onTouchMove={(e) => {
                                    e.preventDefault();
                                }}
                            />
                            
                            <motion.div
                                ref={dropdownRef}
                                initial={{ opacity: 0, y: coords.openUp ? 10 : -10, scale: 0.95 }}
                                animate={{ opacity: 1, y: coords.openUp ? -4 : 4, scale: 1 }}
                                exit={{ opacity: 0, y: coords.openUp ? 10 : -10, scale: 0.95 }}
                                transition={{ duration: 0.15, ease: "easeOut" }}
                                className="fixed z-[9999] bg-[#1A1C23] border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl overflow-hidden"
                                style={{
                                    top: coords.openUp ? 'auto' : coords.top + 4,
                                    bottom: coords.openUp ? (window.innerHeight - coords.top) + 4 : 'auto',
                                    left: coords.left,
                                    width: Math.max(coords.width, 220),
                                    minWidth: 220,
                                }}
                            >
                                <div 
                                    className="max-h-[300px] overflow-y-auto custom-scrollbar py-2 overscroll-contain"
                                    style={{ touchAction: 'pan-y' }}
                                    onWheel={(e) => e.stopPropagation()}
                                >
                                    {options.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-gray-500 italic">No options available</div>
                                    ) : (
                                        options.map((option) => {
                                            const val = typeof option === 'string' ? option : option.value;
                                            const label = typeof option === 'string' ? option : option.label;
                                            return (
                                                <button
                                                    key={val}
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onChange(val);
                                                        setIsOpen(false);
                                                    }}
                                                    className={`w-full px-4 py-3 text-left text-sm flex items-center justify-between transition-colors
                                                        ${getOptionClasses(val)}
                                                    `}
                                                >
                                                    <span>{label}</span>
                                                    {value === val && <Check className={`w-4 h-4 ${getCheckIconColor()}`} />}
                                                </button>
                                            );
                                        })
                                    )}
                                </div>
                            </motion.div>
                        </>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
});

export default CustomSelect;
