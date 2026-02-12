import { useState, useEffect } from 'react';
import { GraduationCap, BookOpen, ArrowLeft, ExternalLink, PlayCircle, FileText } from 'lucide-react';

interface Course {
    name: string;
    duration: string;
    cost: string;
    icon: string;
    description: string;
    study_material?: string; // Kept for backward compatibility handling
    video_url?: string;      // Kept for backward compatibility handling
    videos?: { title: string; url: string }[];
}

interface SkillsDashboardProps {
    onBack: () => void;
    courses: Course[];
    headerText?: string;
    labels: any;
}

const SkillsDashboard = ({ onBack, courses, headerText, labels }: SkillsDashboardProps) => {
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [activeVideo, setActiveVideo] = useState<string | null>(null);

    // Effect to set initial video when course opens
    useEffect(() => {
        if (selectedCourse) {
            if (selectedCourse.videos && selectedCourse.videos.length > 0) {
                setActiveVideo(selectedCourse.videos[0].url);
            } else if (selectedCourse.video_url) {
                setActiveVideo(selectedCourse.video_url);
            } else {
                setActiveVideo(null);
            }
        }
    }, [selectedCourse]);

    const renderCourseDetail = (course: Course) => (
        <div className="flex flex-col h-full animate-fade-in">
            <button onClick={() => setSelectedCourse(null)} className="flex items-center gap-2 text-blue-400 hover:text-blue-300 mb-6 transition-colors self-start">
                <ArrowLeft className="w-5 h-5" /> {labels.back}
            </button>

            <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                <div className="glass-panel p-8 rounded-3xl border-blue-500/20 bg-blue-500/5">
                    <h2 className="text-3xl font-bold text-white mb-4">{course.name}</h2>
                    <p className="text-gray-300 mb-8 text-lg">{course.description}</p>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Video Section */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-blue-300 flex items-center gap-2">
                                <PlayCircle className="w-6 h-6" /> {labels.watch}
                            </h3>
                            <div className="aspect-video bg-black/40 rounded-2xl overflow-hidden border border-white/10 shadow-xl">
                                {activeVideo ? (
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        src={activeVideo}
                                        title={course.name}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    ></iframe>
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-gray-500">
                                        No video available
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Study Material / Course Playlist Section */}
                        <div className="space-y-4">
                            <h3 className="text-xl font-semibold text-emerald-300 flex items-center gap-2">
                                <FileText className="w-6 h-6" /> Course Materials
                            </h3>
                            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 h-full max-h-60 overflow-y-auto custom-scrollbar">
                                {course.videos && course.videos.length > 0 ? (
                                    <div className="space-y-3">
                                        <p className="text-sm text-gray-400 mb-2 font-medium">Materials: 0 / {course.videos.length}</p>
                                        {course.videos.map((video, idx) => (
                                            <div
                                                key={idx}
                                                onClick={() => setActiveVideo(video.url)}
                                                className={`p-4 rounded-xl cursor-pointer transition-all border ${activeVideo === video.url
                                                    ? 'bg-blue-500/20 border-blue-500/40'
                                                    : 'bg-white/5 border-white/5 hover:bg-white/10'
                                                    }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className={`mt-1 bg-transparent border-2 w-5 h-5 flex items-center justify-center rounded transition-colors ${activeVideo === video.url ? 'border-blue-400' : 'border-gray-500'
                                                        }`}>
                                                        {activeVideo === video.url && <div className="w-2.5 h-2.5 bg-blue-400 rounded-sm" />}
                                                    </div>
                                                    <div>
                                                        <h4 className={`text-sm font-medium ${activeVideo === video.url ? 'text-white' : 'text-gray-300'
                                                            }`}>
                                                            {idx + 1}. {video.title}
                                                        </h4>
                                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                                            <PlayCircle className="w-3 h-3" /> youtube
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-300 whitespace-pre-wrap leading-relaxed p-2">
                                        {course.study_material || "No study material available for this course."}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col w-full max-w-6xl mx-auto h-[85vh] animate-slide-up my-auto">
            {!selectedCourse && (
                <header className="flex items-center gap-4 mb-8 shrink-0">
                    <button onClick={onBack} className="p-2 rounded-full hover:bg-white/10 text-gray-400 transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-3">
                        <GraduationCap className="w-8 h-8 text-blue-400" />
                        <h2 className="text-3xl font-bold">
                            {headerText ? (
                                <>
                                    {headerText.split(' ')[0]} <span className="text-blue-400">{headerText.split(' ').slice(1).join(' ')}</span>
                                </>
                            ) : (
                                <>Agricultural <span className="text-blue-400">Education</span></>
                            )}
                        </h2>
                    </div>
                </header>
            )}

            <div className="flex-1 overflow-hidden">
                {selectedCourse ? renderCourseDetail(selectedCourse) : (
                    <div className="h-full overflow-y-auto pr-4 custom-scrollbar pb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {courses.length > 0 ? (
                                courses.map((course, index) => (
                                    <div
                                        key={index}
                                        className="glass-panel p-6 rounded-3xl border-white/5 bg-white/5 hover:bg-white/10 transition-all duration-300 group flex flex-col h-full"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="p-3 bg-blue-500/20 rounded-2xl text-blue-400">
                                                <BookOpen className="w-6 h-6" />
                                            </div>
                                            <div className="text-xs font-medium text-gray-500 bg-white/5 px-3 py-1 rounded-full">
                                                Expert Led
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold mb-2 group-hover:text-blue-400 transition-colors">{course.name}</h3>
                                        <p className="text-gray-400 text-sm mb-6 flex-1 line-clamp-3">{course.description}</p>

                                        <div className="mb-6">
                                            {/* Duration and Cost removed as per user request */}
                                        </div>

                                        <button
                                            onClick={() => setSelectedCourse(course)}
                                            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20 active:scale-[0.98]"
                                        >
                                            {labels.open}
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-500 opacity-50">
                                    <GraduationCap className="w-16 h-16 mb-4" />
                                    <p>Loading course modules...</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SkillsDashboard;
