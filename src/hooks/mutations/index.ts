/**
 * Centralized exports for all mutation hooks
 */

// Position mutations
export {
  useCreatePosition,
  useUpdatePosition,
  useDeletePosition,
} from './usePositionMutations'

// Product mutations
export {
  useUpdateProduct,
  useDeleteProduct,
  useSaveProductCommissions,
  useSyncCommissions,
} from './useProductMutations'

// Carrier mutations
export {
  useRefreshCarriers,
  useSaveCarrierLogin,
} from './useCarrierMutations'

// Policy report mutations
export {
  useCreatePolicyReportJob,
  useSignPolicyReportFiles,
} from './usePolicyReportMutations'

// Onboarding mutations
export {
  useInviteAgent,
  useRunNiprAutomation,
  useUploadNiprDocument,
  useCreateOnboardingPolicyJob,
  useSignOnboardingPolicyFiles,
  useOnboardingCarrierLogin,
} from './useOnboardingMutations'

// Agent mutations
export {
  useAssignPosition,
  useResendInvite,
  useSendInvite,
  useUpdateAgent,
  useDeleteAgent,
} from './useAgentMutations'

// Auth mutations
export {
  useRegister,
  useResetPassword,
  useCompleteOnboarding,
} from './useAuthMutations'

// SMS mutations
export {
  useSendMessage,
  useApproveDrafts,
  useRejectDrafts,
  useEditDraft,
  useResolveNotification,
} from './useSMSMutations'

// Conversation mutations
export {
  useCheckConversation,
  useCreateConversation,
  useStartConversation,
  useGetOrCreateConversation,
} from './useConversationMutations'

// Subscription mutations
export {
  useCreateCheckoutSession,
  useChangeSubscription,
  useAddSubscriptionItem,
  useOpenBillingPortal,
  useCreateTopUpSession,
  useSubscription,
} from './useSubscriptionMutations'
