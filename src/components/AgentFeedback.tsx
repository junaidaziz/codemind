// Agent Feedback Form Component for CodeMind
'use client';

import React, { useState, useCallback } from 'react';
import { useAuth } from '../app/contexts/AuthContext';
import { 
  type SubmitFeedbackRequest,
  type AgentFeedbackType,
  type AgentFeedbackCategory,
} from '../types/feedback';

interface FeedbackFormProps {
  messageId: string;
  sessionId: string;
  projectId: string;
  onSubmit?: (feedback: SubmitFeedbackRequest) => void;
  onClose?: () => void;
  initialCategory?: AgentFeedbackCategory;
  compact?: boolean;
  showCategories?: AgentFeedbackCategory[];
}

interface QuickFeedbackProps {
  messageId: string;
  sessionId: string;
  projectId: string;
  onFeedback?: (rating: number, type: AgentFeedbackType) => void;
}

/**
 * Quick thumbs up/down feedback component
 */
export const QuickFeedback: React.FC<QuickFeedbackProps> = ({
  messageId,
  sessionId,
  projectId,
  onFeedback,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<'positive' | 'negative' | null>(null);

  const handleQuickFeedback = useCallback(async (isPositive: boolean) => {
    if (isSubmitting || submitted) return;

    setIsSubmitting(true);
    
    const rating = isPositive ? 5 : 1;
    const feedbackType: AgentFeedbackType = isPositive ? 'POSITIVE' : 'NEGATIVE';

    try {
      const feedbackData: SubmitFeedbackRequest = {
        messageId,
        sessionId,
        projectId,
        feedbackType,
        rating,
        category: 'OVERALL',
        responseTime: 1000, // Quick feedback assumed to be ~1 second
      };

      // Submit to API
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      });

      if (response.ok) {
        setSubmitted(isPositive ? 'positive' : 'negative');
        onFeedback?.(rating, feedbackType);
      } else {
        console.error('Failed to submit feedback');
      }
    } catch (error) {
      console.error('Error submitting quick feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [messageId, sessionId, projectId, isSubmitting, submitted, onFeedback]);

  if (submitted) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span>Thanks for your feedback!</span>
        <span>{submitted === 'positive' ? '👍' : '👎'}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => handleQuickFeedback(true)}
        disabled={isSubmitting}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 text-gray-500 hover:text-green-600"
        title="This response was helpful"
      >
        👍
      </button>
      <button
        onClick={() => handleQuickFeedback(false)}
        disabled={isSubmitting}
        className="p-1 rounded hover:bg-gray-100 disabled:opacity-50 text-gray-500 hover:text-red-600"
        title="This response was not helpful"
      >
        👎
      </button>
    </div>
  );
};

/**
 * Detailed feedback form component
 */
export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  messageId,
  sessionId,
  projectId,
  onSubmit,
  onClose,
  initialCategory = 'OVERALL',
  compact = false,
  showCategories = ['ACCURACY', 'HELPFULNESS', 'RELEVANCE', 'COMPLETENESS', 'CLARITY', 'OVERALL'],
}) => {
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    rating: 0,
    category: initialCategory,
    comment: '',
  });

  const categories: Record<AgentFeedbackCategory, string> = {
    ACCURACY: 'Accuracy',
    HELPFULNESS: 'Helpfulness',
    RELEVANCE: 'Relevance',
    COMPLETENESS: 'Completeness',
    CLARITY: 'Clarity',
    SPEED: 'Response Speed',
    OVERALL: 'Overall Satisfaction',
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.rating || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const feedbackType: AgentFeedbackType = 
        formData.rating >= 4 ? 'POSITIVE' : 
        formData.rating <= 2 ? 'NEGATIVE' : 'NEUTRAL';

      const feedbackData: SubmitFeedbackRequest = {
        messageId,
        sessionId,
        projectId,
        feedbackType,
        rating: formData.rating,
        category: formData.category as AgentFeedbackCategory,
        comment: formData.comment || undefined,
        responseTime: Date.now(), // Simple timestamp for now
        contextData: {
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString(),
          formType: compact ? 'compact' : 'detailed',
        },
      };

      // Submit to API
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      });

      if (response.ok) {
        onSubmit?.(feedbackData);
        onClose?.();
      } else {
        const errorData = await response.json();
        console.error('Failed to submit feedback:', errorData);
        alert('Failed to submit feedback. Please try again.');
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, messageId, sessionId, projectId, compact, isSubmitting, onSubmit, onClose]);

  const handleRatingClick = (rating: number) => {
    setFormData(prev => ({ ...prev, rating }));
  };

  if (!user) return null;

  return (
    <div className={`bg-white border rounded-lg shadow-sm ${compact ? 'p-3' : 'p-4'}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className={`font-medium ${compact ? 'text-sm' : 'text-base'}`}>
            Rate this response
          </h3>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          )}
        </div>

        {/* Rating */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Rating
          </label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => handleRatingClick(star)}
                className={`text-2xl transition-colors ${
                  star <= formData.rating 
                    ? 'text-yellow-400 hover:text-yellow-500' 
                    : 'text-gray-300 hover:text-yellow-400'
                }`}
              >
                ⭐
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500">
            {formData.rating === 0 && 'Select a rating'}
            {formData.rating === 1 && 'Very poor'}
            {formData.rating === 2 && 'Poor'}
            {formData.rating === 3 && 'Average'}
            {formData.rating === 4 && 'Good'}
            {formData.rating === 5 && 'Excellent'}
          </p>
        </div>

        {/* Category */}
        {!compact && showCategories.length > 1 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData(prev => ({ 
                ...prev, 
                category: e.target.value as AgentFeedbackCategory 
              }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {showCategories.map(category => (
                <option key={category} value={category}>
                  {categories[category]}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Comment */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Comment {formData.rating <= 2 && <span className="text-red-500">*</span>}
          </label>
          <textarea
            value={formData.comment}
            onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
            placeholder={
              formData.rating <= 2 
                ? 'Please tell us what could be improved...' 
                : 'Optional: Tell us more about your experience...'
            }
            rows={compact ? 2 : 3}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            required={formData.rating <= 2}
          />
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-2">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!formData.rating || isSubmitting || (formData.rating <= 2 && !formData.comment.trim())}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
          </button>
        </div>
      </form>
    </div>
  );
};

/**
 * Feedback display component for showing existing feedback
 */
interface FeedbackDisplayProps {
  feedback: {
    id: string;
    rating: number;
    comment?: string;
    category: string;
    feedbackType: AgentFeedbackType;
    createdAt: Date;
    user: {
      name?: string;
    };
  };
  showUserInfo?: boolean;
  compact?: boolean;
}

export const FeedbackDisplay: React.FC<FeedbackDisplayProps> = ({
  feedback,
  showUserInfo = true,
  compact = false,
}) => {
  const getRatingColor = (rating: number) => {
    if (rating >= 4) return 'text-green-600';
    if (rating >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className={`border-l-4 pl-3 ${compact ? 'py-2' : 'py-3'} ${
      feedback.feedbackType === 'POSITIVE' ? 'border-green-400 bg-green-50' :
      feedback.feedbackType === 'NEGATIVE' ? 'border-red-400 bg-red-50' :
      'border-yellow-400 bg-yellow-50'
    }`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex">
            {[1, 2, 3, 4, 5].map((star) => (
              <span
                key={star}
                className={`text-sm ${
                  star <= feedback.rating ? 'text-yellow-400' : 'text-gray-300'
                }`}
              >
                ⭐
              </span>
            ))}
          </div>
          <span className={`text-sm font-medium ${getRatingColor(feedback.rating)}`}>
            {feedback.rating}/5
          </span>
          {!compact && (
            <span className="text-xs text-gray-500 capitalize">
              {feedback.category.toLowerCase()}
            </span>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          {showUserInfo && feedback.user.name && (
            <span>{feedback.user.name} • </span>
          )}
          {formatDate(feedback.createdAt)}
        </div>
      </div>
      
      {feedback.comment && (
        <p className={`text-gray-700 mt-1 ${compact ? 'text-sm' : 'text-base'}`}>
          {feedback.comment}
        </p>
      )}
    </div>
  );
};