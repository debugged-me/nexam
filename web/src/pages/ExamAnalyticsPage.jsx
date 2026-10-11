import '../styles/analytics.css';
/**
 * ExamAnalyticsPage — exam-level results at a real URL (/analytics/exam/:id).
 *
 * Used to be a state-swapped view inside AnalyticsPage: clicking an exam
 * replaced the whole screen without changing the address bar, so the
 * browser Back button jumped clean out of Analytics and the view couldn't
 * be linked or refreshed. Now the detail loads its own route — Back,
 * refresh, and deep links all behave like every other screen.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast.jsx';
import api from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import { CardsSkeleton } from '../components/Loaders.jsx';
import { ExamDetail } from './AnalyticsPage.jsx';

export default function ExamAnalyticsPage() {
  const { examId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [detail, setDetail] = useState(null);

  // Keyed by examId — a response for exam A can never render under exam B's
  // URL when navigating between exams.
  useEffect(() => {
    let cancelled = false;
    api.get(`/analytics/exam/${examId}`)
      .then((d) => { if (!cancelled) setDetail({ examId, ...d }); })
      .catch((err) => {
        toast.error(err.message || 'Could not load exam analytics.');
        navigate('/analytics', { replace: true });
      });
    return () => { cancelled = true; };
  }, [examId, navigate, toast]);

  return (
    <AppShell pageClass="analytics" activeNav="analytics" pageTitle="Analytics" wide>
      {detail?.examId === examId
        ? <ExamDetail examId={examId} detail={detail} onBack={() => navigate('/analytics')} />
        : <CardsSkeleton tiles={4} />}
    </AppShell>
  );
}
