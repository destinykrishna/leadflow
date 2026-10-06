import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/Dialog'
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Edit2,
  Check,
  AlertCircle,
  Loader2,
  FileSpreadsheet,
  Settings,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/components/ui/Toast'
import {
  useCreateForm,
  useUpdateForm,
} from '../api/forms.api'
import type {
  IForm,
  IFormField,
  FormFieldType,
  FormStatus,
} from '@/types/form.types'
import { FORM_FIELD_TYPES } from '@/types/form.types'
import {
  validateForm,
  createFormClientSchema,
  updateFormClientSchema,
} from '@/lib/validation'

interface FormBuilderModalProps {
  isOpen: boolean
  onClose: () => void
  form?: IForm | null
}

function slugifyKey(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function slugifyUrl(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function FormBuilderModal({
  isOpen,
  onClose,
  form,
}: FormBuilderModalProps) {
  const isEditing = Boolean(form)
  const { showToast } = useToast()

  const createMutation = useCreateForm()
  const updateMutation = useUpdateForm()

  // Form Settings State
  const [activeTab, setActiveTab] = React.useState<'settings' | 'fields'>('settings')
  const [title, setTitle] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [status, setStatus] = React.useState<FormStatus>('DRAFT')
  const [submitButtonText, setSubmitButtonText] = React.useState('Submit')
  const [successMessage, setSuccessMessage] = React.useState(
    'Thank you for your submission.',
  )

  // Fields State
  const [fields, setFields] = React.useState<IFormField[]>([])

  // Field Editor Sub-Form State
  const [isAddingField, setIsAddingField] = React.useState(false)
  const [editingFieldIndex, setEditingFieldIndex] = React.useState<number | null>(null)
  const [fieldLabel, setFieldLabel] = React.useState('')
  const [fieldKey, setFieldKey] = React.useState('')
  const [isFieldKeyManuallyEdited, setIsFieldKeyManuallyEdited] = React.useState(false)
  const [fieldType, setFieldType] = React.useState<FormFieldType>('text')
  const [fieldRequired, setFieldRequired] = React.useState(false)
  const [fieldPlaceholder, setFieldPlaceholder] = React.useState('')
  const [fieldHelpText, setFieldHelpText] = React.useState('')
  const [fieldOptionsText, setFieldOptionsText] = React.useState('')
  const [fieldEditorError, setFieldEditorError] = React.useState<string | null>(null)

  // Form-level validation errors
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [serverError, setServerError] = React.useState<string | null>(null)

  // Initialize or reset form state
  React.useEffect(() => {
    if (form) {
      setTitle(form.title)
      setSlug(form.slug)
      setDescription(form.description || '')
      setStatus(form.status)
      setSubmitButtonText(form.submitButtonText || 'Submit')
      setSuccessMessage(form.successMessage || 'Thank you for your submission.')
      // Ensure fields are sorted by order and contiguous
      const sorted = [...form.fields]
        .sort((a, b) => a.order - b.order)
        .map((f, idx) => ({ ...f, order: idx }))
      setFields(sorted)
    } else {
      setTitle('')
      setSlug('')
      setDescription('')
      setStatus('DRAFT')
      setSubmitButtonText('Submit')
      setSuccessMessage('Thank you for your submission.')
      setFields([
        {
          fieldKey: 'full_name',
          label: 'Full Name',
          type: 'text',
          required: true,
          order: 0,
          placeholder: 'e.g. Rahul Sharma',
        },
        {
          fieldKey: 'email',
          label: 'Email Address',
          type: 'email',
          required: true,
          order: 1,
          placeholder: 'rahul.sharma@example.com',
        },
        {
          fieldKey: 'phone',
          label: 'Phone Number',
          type: 'phone',
          required: false,
          order: 2,
          placeholder: '+91 98765 43210',
        },
      ])
    }

    setActiveTab('settings')
    setIsAddingField(false)
    setEditingFieldIndex(null)
    setErrors({})
    setServerError(null)
  }, [form, isOpen])

  // Auto-slugify form URL from title in create mode
  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!isEditing) {
      setSlug(slugifyUrl(val))
    }
  }

  // Auto-slugify fieldKey from label when adding a field
  const handleFieldLabelChange = (val: string) => {
    setFieldLabel(val)
    if (!isFieldKeyManuallyEdited) {
      setFieldKey(slugifyKey(val))
    }
  }

  // Open field adder
  const handleOpenAddField = () => {
    setEditingFieldIndex(null)
    setFieldLabel('')
    setFieldKey('')
    setIsFieldKeyManuallyEdited(false)
    setFieldType('text')
    setFieldRequired(false)
    setFieldPlaceholder('')
    setFieldHelpText('')
    setFieldOptionsText('')
    setFieldEditorError(null)
    setIsAddingField(true)
  }

  // Open field editor
  const handleEditField = (index: number) => {
    const target = fields[index]
    if (!target) return
    setEditingFieldIndex(index)
    setFieldLabel(target.label)
    setFieldKey(target.fieldKey)
    setIsFieldKeyManuallyEdited(true)
    setFieldType(target.type)
    setFieldRequired(target.required)
    setFieldPlaceholder(target.placeholder || '')
    setFieldHelpText(target.helpText || '')
    setFieldOptionsText((target.options || []).join(', '))
    setFieldEditorError(null)
    setIsAddingField(true)
  }

  // Save current field
  const handleSaveField = () => {
    setFieldEditorError(null)
    const trimmedLabel = fieldLabel.trim()
    const trimmedKey = fieldKey.trim().toLowerCase()

    if (!trimmedLabel) {
      setFieldEditorError('Field label is required')
      return
    }

    if (!trimmedKey) {
      setFieldEditorError('Field key is required')
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmedKey)) {
      setFieldEditorError(
        'Field key may only contain alphanumeric characters, underscores, and hyphens',
      )
      return
    }

    // Check duplicate keys (ignoring currently edited field)
    const duplicate = fields.some(
      (f, idx) =>
        f.fieldKey.toLowerCase() === trimmedKey &&
        (editingFieldIndex === null || idx !== editingFieldIndex),
    )

    if (duplicate) {
      setFieldEditorError(`A field with key "${trimmedKey}" already exists.`)
      return
    }

    // Parse options if select
    let options: string[] | undefined = undefined
    if (fieldType === 'select') {
      const parsed = fieldOptionsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      if (parsed.length === 0) {
        setFieldEditorError('Select fields must have at least one option (comma separated).')
        return
      }
      options = parsed
    }

    const newFieldItem: IFormField = {
      fieldKey: trimmedKey,
      label: trimmedLabel,
      type: fieldType,
      required: fieldRequired,
      order: editingFieldIndex !== null ? fields[editingFieldIndex].order : fields.length,
      placeholder: fieldPlaceholder.trim() || undefined,
      helpText: fieldHelpText.trim() || undefined,
      options,
    }

    let updatedList: IFormField[]
    if (editingFieldIndex !== null) {
      updatedList = [...fields]
      updatedList[editingFieldIndex] = newFieldItem
    } else {
      updatedList = [...fields, newFieldItem]
    }

    // Recompute contiguous order
    const reordered = updatedList.map((f, idx) => ({ ...f, order: idx }))
    setFields(reordered)
    setIsAddingField(false)
    setEditingFieldIndex(null)
  }

  // Remove field
  const handleDeleteField = (index: number) => {
    const filtered = fields.filter((_, idx) => idx !== index)
    const reordered = filtered.map((f, idx) => ({ ...f, order: idx }))
    setFields(reordered)
  }

  // Simple field ordering: Move Up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return
    const reordered = [...fields]
    const temp = reordered[index - 1]
    reordered[index - 1] = reordered[index]
    reordered[index] = temp
    const contiguous = reordered.map((f, idx) => ({ ...f, order: idx }))
    setFields(contiguous)
  }

  // Simple field ordering: Move Down
  const handleMoveDown = (index: number) => {
    if (index >= fields.length - 1) return
    const reordered = [...fields]
    const temp = reordered[index + 1]
    reordered[index + 1] = reordered[index]
    reordered[index] = temp
    const contiguous = reordered.map((f, idx) => ({ ...f, order: idx }))
    setFields(contiguous)
  }

  // Handle final submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    setErrors({})

    const payload = {
      title,
      slug,
      description,
      status,
      fields,
      submitButtonText,
      successMessage,
    }

    try {
      if (isEditing && form) {
        const validation = validateForm(updateFormClientSchema, payload)
        if (!validation.success) {
          setErrors(validation.errors)
          setServerError(validation.message)
          if (validation.errors['title'] || validation.errors['slug']) {
            setActiveTab('settings')
          } else if (validation.errors['fields']) {
            setActiveTab('fields')
          }
          return
        }

        await updateMutation.mutateAsync({
          id: form._id,
          payload: validation.data,
        })
        showToast({
          type: 'success',
          title: 'Form Updated',
          message: `Form "${title}" updated successfully.`,
        })
      } else {
        const validation = validateForm(createFormClientSchema, payload)
        if (!validation.success) {
          setErrors(validation.errors)
          setServerError(validation.message)
          if (validation.errors['title'] || validation.errors['slug']) {
            setActiveTab('settings')
          } else if (validation.errors['fields']) {
            setActiveTab('fields')
          }
          return
        }

        await createMutation.mutateAsync(validation.data)
        showToast({
          type: 'success',
          title: 'Form Created',
          message: `Form "${title}" created successfully.`,
        })
      }
      onClose()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save form'
      setServerError(msg)
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isSaving && onClose()}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-white max-h-[92dvh] flex flex-col">
        {/* Modal Header */}
        <div className="border-b border-border bg-slate-50/50 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-slate-900 leading-tight">
                {isEditing ? `Edit Form: ${form?.title}` : 'Create Intake Form'}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Configure form properties, customize input fields, and manage intake ordering
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center border-b border-border px-6 bg-slate-50/30">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'settings'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-muted-foreground hover:text-slate-900'
            }`}
          >
            <Settings className="h-3.5 w-3.5" />
            <span>Form Settings</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('fields')}
            className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              activeTab === 'fields'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-muted-foreground hover:text-slate-900'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Form Fields ({fields.length})</span>
          </button>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {serverError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-xs text-rose-800 flex items-start gap-2 animate-in fade-in-50">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span>{serverError}</span>
            </div>
          )}

          {activeTab === 'settings' ? (
            /* TAB 1: FORM SETTINGS */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Form Title *"
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. NRI Home Loan Pre-Approval"
                  error={errors['title']}
                  required
                />
                <Input
                  label="URL Slug *"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  placeholder="e.g. nri-home-loan"
                  error={errors['slug']}
                  helperText="Alphanumeric with hyphens, public identifier"
                  required
                />
              </div>

              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Short introductory message displayed to prospective applicants..."
                  className="w-full rounded-md border border-input bg-card px-3 py-2 text-xs text-foreground shadow-2xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
                />
                {errors['description'] && (
                  <p className="text-xs text-destructive">{errors['description']}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5 text-left">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Form Status
                  </label>
                  <Select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as FormStatus)}
                  >
                    <option value="DRAFT">DRAFT (Internal only)</option>
                    <option value="PUBLISHED">PUBLISHED (Accepts leads)</option>
                    <option value="ARCHIVED">ARCHIVED (Inactive)</option>
                  </Select>
                </div>

                <Input
                  label="Submit Button Text"
                  value={submitButtonText}
                  onChange={(e) => setSubmitButtonText(e.target.value)}
                  placeholder="Submit"
                  error={errors['submitButtonText']}
                />

                <Input
                  label="Success Message"
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  placeholder="Thank you for your submission."
                  error={errors['successMessage']}
                />
              </div>
            </div>
          ) : (
            /* TAB 2: FIELD BUILDER */
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Ordered Field Sequence
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    Use Up and Down controls to sequence the questionnaire flow.
                  </p>
                </div>
                {!isAddingField && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleOpenAddField}
                    className="gap-1.5 text-xs shadow-2xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Field</span>
                  </Button>
                )}
              </div>

              {/* Add / Edit Field Sub-Card */}
              {isAddingField && (
                <div className="rounded-xl border border-primary/20 bg-slate-50/70 p-4 space-y-3.5 animate-in fade-in-50">
                  <div className="flex items-center justify-between border-b border-border/70 pb-2">
                    <span className="text-xs font-bold text-slate-900">
                      {editingFieldIndex !== null ? 'Edit Field' : 'Add New Field'}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAddingField(false)}
                      className="text-xs text-muted-foreground hover:text-slate-900"
                    >
                      Cancel
                    </button>
                  </div>

                  {fieldEditorError && (
                    <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded border border-rose-200">
                      {fieldEditorError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Input
                      label="Field Label *"
                      value={fieldLabel}
                      onChange={(e) => handleFieldLabelChange(e.target.value)}
                      placeholder="e.g. Loan Amount Needed"
                      required
                    />

                    <Input
                      label="Field Key *"
                      value={fieldKey}
                      onChange={(e) => {
                        setIsFieldKeyManuallyEdited(true)
                        setFieldKey(slugifyKey(e.target.value))
                      }}
                      placeholder="e.g. loan_amount"
                      helperText="Unique variable key (alphanumeric & underscores)"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5 text-left">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                        Field Type
                      </label>
                      <Select
                        value={fieldType}
                        onChange={(e) => setFieldType(e.target.value as FormFieldType)}
                      >
                        {FORM_FIELD_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {type.toUpperCase()}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <Input
                      label="Placeholder"
                      value={fieldPlaceholder}
                      onChange={(e) => setFieldPlaceholder(e.target.value)}
                      placeholder="e.g. ₹50,00,000"
                    />

                    <Input
                      label="Help Text"
                      value={fieldHelpText}
                      onChange={(e) => setFieldHelpText(e.target.value)}
                      placeholder="Supporting guidance for applicant..."
                    />
                  </div>

                  {fieldType === 'select' && (
                    <div className="space-y-1.5 text-left">
                      <Input
                        label="Select Options (Comma separated) *"
                        value={fieldOptionsText}
                        onChange={(e) => setFieldOptionsText(e.target.value)}
                        placeholder="Option 1, Option 2, Option 3"
                        helperText="Separate choices with commas"
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="field-required-toggle"
                      checked={fieldRequired}
                      onChange={(e) => setFieldRequired(e.target.checked)}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                    />
                    <label
                      htmlFor="field-required-toggle"
                      className="text-xs font-medium text-slate-800 cursor-pointer select-none"
                    >
                      Mandatory field (requires applicant entry)
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsAddingField(false)}
                      className="text-xs"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveField}
                      className="gap-1.5 text-xs shadow-2xs"
                    >
                      <Check className="h-3.5 w-3.5" />
                      <span>{editingFieldIndex !== null ? 'Update Field' : 'Insert Field'}</span>
                    </Button>
                  </div>
                </div>
              )}

              {/* Field Sequence List */}
              {fields.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center bg-slate-50/40">
                  <p className="text-xs text-muted-foreground">
                    No fields configured yet. Click "Add Field" to begin building the questionnaire.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, idx) => (
                    <div
                      key={field.fieldKey + idx}
                      className="flex items-center justify-between rounded-lg border border-border bg-card p-3 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Order Index Badge */}
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-[11px] font-bold text-slate-600">
                          #{idx + 1}
                        </div>

                        {/* Field Info */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-900 truncate">
                              {field.label}
                            </span>
                            {field.required && (
                              <Badge variant="danger" size="sm" className="text-[9px] py-0 px-1">
                                Required
                              </Badge>
                            )}
                            <Badge variant="neutral" size="sm" className="text-[9px] py-0 px-1 uppercase">
                              {field.type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                            <span className="font-mono">key: {field.fieldKey}</span>
                            {field.options && field.options.length > 0 && (
                              <span>• {field.options.length} options</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Controls: Up, Down, Edit, Delete */}
                      <div className="flex items-center gap-1 shrink-0">
                        {/* Up button */}
                        <button
                          type="button"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          title="Move Up"
                          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>

                        {/* Down button */}
                        <button
                          type="button"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === fields.length - 1}
                          title="Move Down"
                          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer disabled:cursor-not-allowed"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>

                        {/* Edit button */}
                        <button
                          type="button"
                          onClick={() => handleEditField(idx)}
                          title="Edit Field"
                          className="flex h-7 w-7 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>

                        {/* Delete button */}
                        <button
                          type="button"
                          onClick={() => handleDeleteField(idx)}
                          title="Delete Field"
                          className="flex h-7 w-7 items-center justify-center rounded text-rose-500 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-border bg-slate-50/50 px-6 py-3.5 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {fields.length} {fields.length === 1 ? 'field' : 'fields'} configured
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSaving}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isSaving}
              className="gap-1.5 text-xs font-semibold shadow-xs"
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isEditing ? 'Save Changes' : 'Create Form'}</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
